'use client'

import { useEffect, useState } from 'react'
import {
  CatalogItem,
  JobAdhocBundle,
  JobAdhocLine,
  DiagnosisItem,
  HistoryJob,
  Job,
  JobAddOn,
  JobSystem,
  ObservationCircuit,
  ObservationCircuitState,
  ObservedComponentState,
  RepairBundle,
} from './types'
import Step1Arrive from './Step1Arrive'
import Step2Observe from './Step2Observe'
import Step3Diagnose from './Step3Diagnose'
import Step4Work from './Step4Work'
import Step5Close from './Step5Close'
import { clearJobAdhocBundle, saveJobAdhocBundle, saveObservations, saveObservedSystemSnapshot, setDiagnosis } from './actions'

function useElapsed(arrivedAt: string | null) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (!arrivedAt) return
    const start = new Date(arrivedAt).getTime()
    const tick = () => setSecs(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [arrivedAt])

  return secs
}

function fmt(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':')
}

const STEPS: string[] = ['Arrive', 'Observe', 'Diagnose', 'Repair', 'Close']
type WorkflowMode = 'diagnosis' | 'adhoc'

function componentTemplate(systemType: string) {
  switch (systemType) {
    case 'heat_pump':
      return [
        { key: 'outdoor', label: 'Condensing Unit', subtype: 'CU' },
        { key: 'indoor', label: 'Air Handler', subtype: 'AHU' },
      ]
    case 'ac_furnace':
      return [
        { key: 'condenser', label: 'Condensing Unit', subtype: 'CU' },
        { key: 'furnace', label: 'Furnace', subtype: 'Furnace' },
        { key: 'coil', label: 'Coil', subtype: 'Coil' },
      ]
    case 'rtu':
      return [{ key: 'rtu', label: 'RTU', subtype: 'RTU' }]
    case 'ptac':
      return [{ key: 'ptac', label: 'PTAC', subtype: 'PTAC' }]
    case 'air_handler':
      return [{ key: 'ahu', label: 'Air Handler', subtype: 'AHU' }]
    case 'condensing_unit':
      return [{ key: 'cu', label: 'Condensing Unit', subtype: 'CU' }]
    default:
      return []
  }
}

function emptyComponent(template: { key: string; label: string; subtype: string }): ObservedComponentState {
  return {
    ...template,
    make: '',
    model: '',
    serial_number: '',
    tonnage: '',
    refrigerant_type: '',
    metering_device: '',
    heating_capacity_btu: '',
  }
}

function mapSystemToComponent(system: JobSystem, fallbackKey: string): ObservedComponentState {
  return {
    id: system.id,
    key: fallbackKey,
    label: system.name ?? fallbackKey,
    subtype: system.system_subtype ?? '',
    make: system.make ?? '',
    model: system.model ?? '',
    serial_number: system.serial_number ?? '',
    tonnage: system.tonnage != null ? String(system.tonnage) : '',
    refrigerant_type: system.refrigerant_type ?? '',
    metering_device: system.metering_device ?? '',
    heating_capacity_btu: system.heating_capacity_btu != null ? String(system.heating_capacity_btu) : '',
  }
}

function initialComponentsForJob(job: Job, systemType: string) {
  const templates = componentTemplate(systemType)
  const existing = job.system_components ?? []
  if (templates.length === 0) return []

  return templates.map(template => {
    const match = existing.find(component => component.system_subtype === template.subtype)
      ?? (job.systems?.system_subtype === template.subtype ? job.systems : null)
    return match ? mapSystemToComponent(match, template.key) : emptyComponent(template)
  })
}

function inferSharedTonnage(job: Job) {
  const candidates = (job.system_components ?? []).map(component => component.tonnage).filter((value): value is number => value != null)
  if (candidates.length > 0) return String(candidates[0])
  return job.systems?.tonnage != null ? String(job.systems.tonnage) : ''
}

function inferSharedRefrigerant(job: Job) {
  const candidates = (job.system_components ?? []).map(component => component.refrigerant_type).filter((value): value is string => !!value)
  return candidates[0] ?? job.systems?.refrigerant_type ?? ''
}

function parseRtuControls(controlsNotes: string | null | undefined) {
  if (!controlsNotes) return { controls: [] as string[], note: '' }
  const lines = controlsNotes.split('\n')
  const controlsLine = lines.find(line => line.startsWith('Controls:'))
  const notesLine = lines.find(line => line.startsWith('Notes:'))
  return {
    controls: controlsLine
      ? controlsLine.replace('Controls:', '').split(',').map(item => item.trim()).filter(Boolean)
      : [],
    note: notesLine ? notesLine.replace('Notes:', '').trim() : '',
  }
}

function emptyObservationCircuit(circuitNumber: 1 | 2): ObservationCircuitState {
  return {
    circuit_number: circuitNumber,
    suction_pressure: '',
    suction_line_temp: '',
    liquid_pressure: '',
    liquid_line_temp: '',
  }
}

function mapObservationCircuit(circuit: ObservationCircuit): ObservationCircuitState {
  return {
    id: circuit.id,
    circuit_number: circuit.circuit_number,
    suction_pressure: circuit.suction_pressure != null ? String(circuit.suction_pressure) : '',
    suction_line_temp: circuit.suction_line_temp != null ? String(circuit.suction_line_temp) : '',
    liquid_pressure: circuit.liquid_pressure != null ? String(circuit.liquid_pressure) : '',
    liquid_line_temp: circuit.liquid_line_temp != null ? String(circuit.liquid_line_temp) : '',
  }
}

function initialObservationCircuits(job: Job) {
  const saved = job.observation_circuits ?? []
  return ([1, 2] as const).map(circuitNumber => {
    const match = saved.find(circuit => circuit.circuit_number === circuitNumber)
    return match ? mapObservationCircuit(match) : emptyObservationCircuit(circuitNumber)
  })
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function isApartmentJob(job: Job) {
  const normalizedUnitType = job.units?.unit_type?.trim().toLowerCase() ?? ''
  const normalizedUnitName = job.units?.name?.trim().toLowerCase() ?? ''
  return !!job.units && normalizedUnitType !== 'main' && normalizedUnitName !== 'default'
}

function withApartmentDefault(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

interface Props {
  job: Job
  serviceHistory: HistoryJob[]
  diagnoses: DiagnosisItem[]
  repairBundles: RepairBundle[]
  catalogItems: CatalogItem[]
  existingAddOns: JobAddOn[]
}

function initialWorkflowMode(job: Job): WorkflowMode {
  return job.adhoc_bundle && !job.diagnosis_id ? 'adhoc' : 'diagnosis'
}

function initialAdhocLines(job: Job): JobAdhocLine[] {
  return job.adhoc_bundle?.job_adhoc_bundle_lines ?? []
}

export default function JobFlow({ job, serviceHistory, diagnoses, repairBundles, catalogItems, existingAddOns }: Props) {
  const apartmentJob = isApartmentJob(job)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [jobStatus, setJobStatus] = useState(job.status)
  const [arrivedAt, setArrivedAt] = useState<string | null>(job.arrived_at)
  const [arrivedLat, setArrivedLat] = useState<number | null>(null)
  const [arrivedLng, setArrivedLng] = useState<number | null>(null)
  const [linkedSystemId, setLinkedSystemId] = useState<string | null>(job.systems?.id ?? null)

  const [tstatMode, setTstatMode] = useState(job.tstat_mode ?? '')
  const [tstatFan, setTstatFan] = useState(job.tstat_fan ?? '')
  const [tempOutdoor, setTempOutdoor] = useState(job.temp_outdoor != null ? String(job.temp_outdoor) : '')
  const [tempOutdoorAuto, setTempOutdoorAuto] = useState<number | null>(job.temp_outdoor_auto ?? null)
  const [tempReturn, setTempReturn] = useState(job.temp_return != null ? String(job.temp_return) : '')
  const [tempSupply, setTempSupply] = useState(job.temp_supply != null ? String(job.temp_supply) : '')
  const [observationNotes, setObservationNotes] = useState(job.arrival_notes ?? '')
  const [observationFiles, setObservationFiles] = useState<File[]>([])
  const [postRepairFiles, setPostRepairFiles] = useState<File[]>([])
  const [observationCircuits, setObservationCircuits] = useState<ObservationCircuitState[]>(initialObservationCircuits(job))
  const [circuit2Enabled, setCircuit2Enabled] = useState((job.observation_circuits ?? []).some(circuit => circuit.circuit_number === 2))
  const [activeCircuit, setActiveCircuit] = useState<1 | 2>(1)

  const initialSystemType = apartmentJob ? 'heat_pump' : (job.systems?.system_type ?? '')
  const [systemName, setSystemName] = useState(
    apartmentJob
      ? withApartmentDefault(job.systems?.group_name ?? job.systems?.name, 'Main')
      : (job.systems?.group_name ?? job.systems?.name ?? '')
  )
  const [systemType, setSystemType] = useState(initialSystemType)
  const [servedAreas, setServedAreas] = useState(
    apartmentJob ? withApartmentDefault(job.systems?.served_areas, 'All') : (job.systems?.served_areas ?? '')
  )
  const [thermostatLocation, setThermostatLocation] = useState(
    apartmentJob ? withApartmentDefault(job.systems?.thermostat_location, 'Hallway') : (job.systems?.thermostat_location ?? '')
  )
  const [equipmentLocation, setEquipmentLocation] = useState(
    apartmentJob ? withApartmentDefault(job.systems?.equipment_location, 'Typical') : (job.systems?.equipment_location ?? '')
  )
  const [systemNotes, setSystemNotes] = useState(job.systems?.notes ?? '')
  const [sharedTonnage, setSharedTonnage] = useState(inferSharedTonnage(job))
  const [sharedRefrigerant, setSharedRefrigerant] = useState(inferSharedRefrigerant(job))
  const parsedControls = parseRtuControls(job.systems?.controls_notes)
  const [rtuControls, setRtuControls] = useState<string[]>(parsedControls.controls)
  const [rtuControlsNote, setRtuControlsNote] = useState(parsedControls.note)
  const [components, setComponents] = useState<ObservedComponentState[]>(initialComponentsForJob(job, initialSystemType))

  useEffect(() => {
    const templates = componentTemplate(systemType)
    setComponents(current => templates.map(template => {
      const existing = current.find(component => component.subtype === template.subtype || component.key === template.key)
      if (existing) {
        return { ...existing, key: template.key, label: template.label, subtype: template.subtype }
      }
      return emptyComponent(template)
    }))
  }, [systemType])

  const initialDiagnosis = job.diagnosis_id
    ? diagnoses.find(diagnosis => diagnosis.id === job.diagnosis_id) ?? null
    : null
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisItem | null>(initialDiagnosis)
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(initialWorkflowMode(job))
  const [adhocDescription, setAdhocDescription] = useState(job.adhoc_bundle?.tech_description ?? '')
  const [adhocLines, setAdhocLines] = useState<JobAdhocLine[]>(initialAdhocLines(job))
  const [savedAdhocBundle, setSavedAdhocBundle] = useState<JobAdhocBundle | null>(job.adhoc_bundle ?? null)
  const [adhocError, setAdhocError] = useState<string | null>(null)
  const [addOns, setAddOns] = useState<JobAddOn[]>(existingAddOns)
  const [transitioning, setTransitioning] = useState(false)
  const [observeSystemError, setObserveSystemError] = useState<string | null>(null)

  const elapsed = useElapsed(arrivedAt)
  const step2Valid = !!tstatMode && !!tstatFan
  const step3Valid = workflowMode === 'diagnosis' ? !!selectedDiagnosis : !!adhocDescription.trim()
  const hasDiagnosisPath = workflowMode === 'diagnosis' && !!selectedDiagnosis
  const hasAdhocPath = workflowMode === 'adhoc' && !!adhocDescription.trim()
  const canCloseJob = hasDiagnosisPath || !!savedAdhocBundle || hasAdhocPath

  function handleArrived(at: string, lat: number | null, lng: number | null) {
    setArrivedAt(at)
    setArrivedLat(lat)
    setArrivedLng(lng)
    setJobStatus('in_progress')
    setStep(2)
  }

  async function persistObservationContext() {
    setObserveSystemError(null)

    const observationResult = await saveObservations(job.id, {
      tstat_mode: tstatMode,
      tstat_fan: tstatFan,
      temp_outdoor: parseOptionalNumber(tempOutdoor),
      temp_outdoor_auto: tempOutdoorAuto,
      temp_return: parseOptionalNumber(tempReturn),
      temp_supply: parseOptionalNumber(tempSupply),
      arrival_notes: observationNotes,
      circuits: observationCircuits
        .filter(circuit => circuit.circuit_number === 1 || circuit2Enabled)
        .map(circuit => ({
          id: circuit.id ?? null,
          circuit_number: circuit.circuit_number,
          suction_pressure: parseOptionalNumber(circuit.suction_pressure),
          suction_line_temp: parseOptionalNumber(circuit.suction_line_temp),
          liquid_pressure: parseOptionalNumber(circuit.liquid_pressure),
          liquid_line_temp: parseOptionalNumber(circuit.liquid_line_temp),
        })),
    })

    if (observationResult.error) {
      setObserveSystemError(observationResult.error)
      return false
    }

    if (observationResult.circuits) {
      setObservationCircuits(current => current.map(circuit => {
        const saved = observationResult.circuits?.find(item => item.circuit_number === circuit.circuit_number)
        return saved ? mapObservationCircuit(saved) : circuit
      }))
    }

    const snapshotComponents = components.map(component => {
      if (systemType === 'heat_pump') {
        return { ...component, tonnage: sharedTonnage, refrigerant_type: sharedRefrigerant }
      }

      if (systemType === 'ac_furnace' && (component.subtype === 'CU' || component.subtype === 'Coil')) {
        return { ...component, tonnage: sharedTonnage, refrigerant_type: sharedRefrigerant }
      }

      if (systemType === 'ac_furnace' && component.subtype === 'Furnace') {
        return { ...component, refrigerant_type: '', tonnage: '' }
      }

      return component
    })

    if (systemType || linkedSystemId || components.some(component => component.make || component.model || component.serial_number)) {
      const systemResult = await saveObservedSystemSnapshot(job.id, {
        systemName: apartmentJob ? withApartmentDefault(systemName, 'Main') : systemName,
        systemType: apartmentJob ? 'heat_pump' : systemType,
        servedAreas: apartmentJob ? withApartmentDefault(servedAreas, 'All') : servedAreas,
        thermostatLocation: apartmentJob ? withApartmentDefault(thermostatLocation, 'Hallway') : thermostatLocation,
        equipmentLocation: apartmentJob ? withApartmentDefault(equipmentLocation, 'Typical') : equipmentLocation,
        systemNotes,
        rtuControls,
        rtuControlsNote,
        components: snapshotComponents,
      })

      if (systemResult.error) {
        setObserveSystemError(systemResult.error)
        return false
      }

      if (systemResult.primarySystemId) setLinkedSystemId(systemResult.primarySystemId)
      if (systemResult.systems) {
        setComponents(previous => previous.map(component => {
          const match = systemResult.systems.find(saved => saved.system_subtype === component.subtype)
          return match ? mapSystemToComponent(match, component.key) : component
        }))
      }
    }

    return true
  }

  async function handleNext() {
    setAdhocError(null)

    if (step === 2) {
      if (!step2Valid) return
      setTransitioning(true)
      const saved = await persistObservationContext()
      setTransitioning(false)
      if (!saved) return
    }

    if (step === 3) {
      if (!step3Valid) return
      setTransitioning(true)
      const saved = await persistObservationContext()
      if (!saved) {
        setTransitioning(false)
        return
      }
      if (workflowMode === 'diagnosis') {
        const diagnosisResult = await setDiagnosis(job.id, selectedDiagnosis?.id ?? null)
        if (diagnosisResult.error) {
          setAdhocError(diagnosisResult.error)
          setTransitioning(false)
          return
        }

        if (savedAdhocBundle) {
          const clearResult = await clearJobAdhocBundle(job.id)
          if (clearResult.error) {
            setAdhocError(clearResult.error)
            setTransitioning(false)
            return
          }
          setSavedAdhocBundle(null)
          setAdhocLines([])
          setAdhocDescription('')
        }
      }
      setTransitioning(false)
    }

    if (step === 4 && workflowMode === 'adhoc') {
      setTransitioning(true)
      const adhocResult = await saveJobAdhocBundle(job.id, {
        tech_description: adhocDescription,
        lines: adhocLines
          .filter(line => !!line.items?.id && Number.isFinite(line.quantity) && line.quantity > 0)
          .map(line => ({
            item_id: line.items!.id,
            quantity: line.quantity,
          })),
      })

      if (adhocResult.error) {
        setAdhocError(adhocResult.error)
        setTransitioning(false)
        return
      }

      setSavedAdhocBundle({
        id: adhocResult.adhocBundleId!,
        tech_description: adhocDescription.trim(),
        reviewed_by_admin: false,
        admin_action: null,
        promoted_diagnosis_id: null,
        job_adhoc_bundle_lines: adhocLines,
      })
      setTransitioning(false)
    }

    setStep(current => Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5)
  }

  const unitLabel = job.units?.name ?? job.manual_unit ?? ''
  const systemLabel = [job.systems?.make, job.systems?.system_type ? job.systems.system_type.replace('_', ' ') : job.systems?.system_subtype].filter(Boolean).join(' ')

  const statusColors: Record<string, { bg: string; fg: string }> = {
    new: { bg: '#f1efe8', fg: '#5f5e5a' },
    assigned: { bg: '#eaf3de', fg: '#3b6d11' },
    en_route: { bg: '#e6f1fb', fg: '#185fa5' },
    in_progress: { bg: '#faeeda', fg: '#854f0b' },
    completed: { bg: '#f1efe8', fg: '#5f5e5a' },
  }
  const statusColor = statusColors[jobStatus] ?? statusColors.new

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e2e1da', padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {job.customers?.name ?? '-'} - {job.locations?.name ?? '-'}
              {unitLabel ? ` · ${unitLabel}` : ''}
            </div>
            {systemLabel && <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>{systemLabel}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px', background: statusColor.bg, color: statusColor.fg }}>
              {jobStatus.replace('_', ' ')}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '13px', color: arrivedAt ? '#854f0b' : '#b4b2a9', fontWeight: 600 }}>
              {arrivedAt ? fmt(elapsed) : '--:--:--'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0', marginTop: '10px', borderBottom: '1px solid #e2e1da' }}>
          {STEPS.map((label, index) => {
            const number = (index + 1) as 1 | 2 | 3 | 4 | 5
            const active = step === number
            const complete = step > number
            return (
              <button
                key={label}
                onClick={() => { if (complete) setStep(number) }}
                style={{
                  flex: 1,
                  padding: '7px 2px',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: active ? '2px solid #185fa5' : '2px solid transparent',
                  fontSize: '10px',
                  fontWeight: active ? 700 : 400,
                  color: active ? '#185fa5' : complete ? '#3b6d11' : '#b4b2a9',
                  cursor: complete ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  marginBottom: '-1px',
                }}
              >
                {complete ? '✓ ' : ''}{label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {step === 1 && (
          <Step1Arrive job={job} serviceHistory={serviceHistory} onArrived={handleArrived} />
        )}
        {step === 2 && (
          <Step2Observe
            job={job}
            arrivedLat={arrivedLat}
            arrivedLng={arrivedLng}
            tstatMode={tstatMode}
            setTstatMode={setTstatMode}
            tstatFan={tstatFan}
            setTstatFan={setTstatFan}
            tempOutdoor={tempOutdoor}
            setTempOutdoor={setTempOutdoor}
            tempOutdoorAuto={tempOutdoorAuto}
            setTempOutdoorAuto={setTempOutdoorAuto}
            tempReturn={tempReturn}
            setTempReturn={setTempReturn}
            tempSupply={tempSupply}
            setTempSupply={setTempSupply}
            observationNotes={observationNotes}
            setObservationNotes={setObservationNotes}
            observationFiles={observationFiles}
            setObservationFiles={setObservationFiles}
            observationCircuits={observationCircuits}
            setObservationCircuits={setObservationCircuits}
            activeCircuit={activeCircuit}
            setActiveCircuit={setActiveCircuit}
            circuit2Enabled={circuit2Enabled}
            setCircuit2Enabled={setCircuit2Enabled}
            linkedSystemId={linkedSystemId}
            systemName={systemName}
            setSystemName={setSystemName}
            systemType={systemType}
            setSystemType={setSystemType}
            servedAreas={servedAreas}
            setServedAreas={setServedAreas}
            thermostatLocation={thermostatLocation}
            setThermostatLocation={setThermostatLocation}
            equipmentLocation={equipmentLocation}
            setEquipmentLocation={setEquipmentLocation}
            systemNotes={systemNotes}
            setSystemNotes={setSystemNotes}
            sharedTonnage={sharedTonnage}
            setSharedTonnage={setSharedTonnage}
            sharedRefrigerant={sharedRefrigerant}
            setSharedRefrigerant={setSharedRefrigerant}
            rtuControls={rtuControls}
            setRtuControls={setRtuControls}
            rtuControlsNote={rtuControlsNote}
            setRtuControlsNote={setRtuControlsNote}
            components={components}
            setComponents={setComponents}
            observeSystemError={observeSystemError}
          />
        )}
        {step === 3 && (
          <Step3Diagnose
            job={job}
            diagnoses={diagnoses}
            selectedDiagnosis={selectedDiagnosis}
            onSelect={setSelectedDiagnosis}
            arrivedLat={arrivedLat}
            arrivedLng={arrivedLng}
            tstatMode={tstatMode}
            setTstatMode={setTstatMode}
            tstatFan={tstatFan}
            setTstatFan={setTstatFan}
            tempOutdoor={tempOutdoor}
            setTempOutdoor={setTempOutdoor}
            tempOutdoorAuto={tempOutdoorAuto}
            setTempOutdoorAuto={setTempOutdoorAuto}
            tempReturn={tempReturn}
            setTempReturn={setTempReturn}
            tempSupply={tempSupply}
            setTempSupply={setTempSupply}
            observationNotes={observationNotes}
            setObservationNotes={setObservationNotes}
            observationFiles={observationFiles}
            setObservationFiles={setObservationFiles}
            observationCircuits={observationCircuits}
            setObservationCircuits={setObservationCircuits}
            activeCircuit={activeCircuit}
            setActiveCircuit={setActiveCircuit}
            circuit2Enabled={circuit2Enabled}
            setCircuit2Enabled={setCircuit2Enabled}
            linkedSystemId={linkedSystemId}
            systemName={systemName}
            setSystemName={setSystemName}
            systemType={systemType}
            setSystemType={setSystemType}
            servedAreas={servedAreas}
            setServedAreas={setServedAreas}
            thermostatLocation={thermostatLocation}
            setThermostatLocation={setThermostatLocation}
            equipmentLocation={equipmentLocation}
            setEquipmentLocation={setEquipmentLocation}
            systemNotes={systemNotes}
            setSystemNotes={setSystemNotes}
            sharedTonnage={sharedTonnage}
            setSharedTonnage={setSharedTonnage}
            sharedRefrigerant={sharedRefrigerant}
            setSharedRefrigerant={setSharedRefrigerant}
            rtuControls={rtuControls}
            setRtuControls={setRtuControls}
            rtuControlsNote={rtuControlsNote}
            setRtuControlsNote={setRtuControlsNote}
            components={components}
            setComponents={setComponents}
            observeSystemError={observeSystemError}
            workflowMode={workflowMode}
            setWorkflowMode={setWorkflowMode}
            adhocDescription={adhocDescription}
            setAdhocDescription={setAdhocDescription}
            adhocError={adhocError}
          />
        )}
        {step === 4 && (
          <Step4Work
            jobId={job.id}
            workflowMode={workflowMode}
            selectedDiagnosis={selectedDiagnosis}
            repairBundles={repairBundles}
            catalogItems={catalogItems}
            addOns={addOns}
            setAddOns={setAddOns}
            adhocDescription={adhocDescription}
            setAdhocDescription={setAdhocDescription}
            adhocLines={adhocLines}
            setAdhocLines={setAdhocLines}
            adhocError={adhocError}
            postRepairFiles={postRepairFiles}
            setPostRepairFiles={setPostRepairFiles}
          />
        )}
        {step === 5 && (
          <Step5Close
            job={job}
            workflowMode={workflowMode}
            selectedDiagnosis={selectedDiagnosis}
            adhocDescription={adhocDescription}
            adhocLines={workflowMode === 'adhoc' ? adhocLines : []}
            tstatMode={tstatMode}
            tstatFan={tstatFan}
            tempOutdoor={tempOutdoor}
            tempReturn={tempReturn}
            tempSupply={tempSupply}
            observationCircuits={observationCircuits.filter(circuit => circuit.circuit_number === 1 || circuit2Enabled)}
            addOns={addOns}
            observationFiles={observationFiles}
            postRepairFiles={postRepairFiles}
            canCloseJob={canCloseJob}
          />
        )}
      </div>

      {step < 5 && (
        <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid #e2e1da', padding: '12px 16px', display: 'flex', gap: '8px' }}>
          {step > 1 && (
            <button
              onClick={() => setStep(current => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5)}
              style={{ padding: '11px 20px', borderRadius: '8px', border: '1px solid #d3d1c7', background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {'<- Back'}
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={
              transitioning
              || (step === 1 && jobStatus !== 'in_progress')
              || (step === 2 && !step2Valid)
              || (step === 3 && !step3Valid)
            }
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: '8px',
              border: 'none',
              background: (transitioning || (step === 1 && jobStatus !== 'in_progress') || (step === 2 && !step2Valid) || (step === 3 && !step3Valid)) ? '#b4b2a9' : '#185fa5',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: (transitioning || (step === 1 && jobStatus !== 'in_progress') || (step === 2 && !step2Valid)) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {transitioning ? 'Saving...' : `${STEPS[step] ?? 'Next'} ->`}
          </button>
        </div>
      )}
    </div>
  )
}
