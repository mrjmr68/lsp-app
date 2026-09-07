'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Job, ObservationCircuitState, ObservedComponentState } from '../types'
import { saveObservations, saveObservedSystemSnapshot } from '../actions'
import ReadingField from '../components/ReadingField'
import PhotoSlot from '../components/PhotoSlot'
import SharedLabel from '../components/SharedLabel'
import ComponentEditor from '../components/ComponentEditor'
import OcrInput from '../components/OcrInput'
import Card from '@/app/components/field/Card'
import Button from '@/app/components/field/Button'
import ChoiceGroup from '@/app/components/field/ChoiceGroup'
import SpokeFooter from '@/app/components/field/SpokeFooter'
import { fieldControlClass } from '@/utils/field/styles'
import { uploadJobPhotos } from '@/utils/field/photos'
import {
  REFRIGERANT_OPTIONS,
  SYSTEM_TYPE_OPTIONS,
} from '@/utils/hvac/systems'
import {
  circuitHasValues,
  emptyCircuits,
  formatDelta,
  inferSharedRefrigerant,
  inferSharedTonnage,
  initialComponentsForJob,
  isApartmentJob,
  parseOptionalNumber,
  parseRtuControls,
  remapComponentsForSystemType,
  withApartmentDefault,
} from './observation'

const RTU_CONTROL_OPTIONS = ['Zone Controller', 'Economizer', 'Smoke Detector', 'VFD', 'BAS Interface']

export default function ObserveClient({ job }: { job: Job }) {
  const router = useRouter()
  const [tab, setTab] = useState<'readings' | 'system'>('readings')
  const [transitioning, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showPressures, setShowPressures] = useState(() =>
    (job.observation_circuits ?? []).some(circuit =>
      circuit.suction_pressure != null
      || circuit.suction_line_temp != null
      || circuit.liquid_pressure != null
      || circuit.liquid_line_temp != null,
    ),
  )

  const apartmentJob = isApartmentJob(job)

  const [tstatMode, setTstatMode] = useState(job.tstat_mode ?? '')
  const [tstatFan, setTstatFan] = useState(job.tstat_fan ?? '')
  const [tempOutdoor, setTempOutdoor] = useState(job.temp_outdoor != null ? String(job.temp_outdoor) : '')
  const [tempOutdoorAuto] = useState<number | null>(job.temp_outdoor_auto ?? null)
  const [tempReturn, setTempReturn] = useState(job.temp_return != null ? String(job.temp_return) : '')
  const [tempSupply, setTempSupply] = useState(job.temp_supply != null ? String(job.temp_supply) : '')
  const [observationNotes, setObservationNotes] = useState(job.arrival_notes ?? '')
  const [observationFiles, setObservationFiles] = useState<File[]>([])

  const savedCircuits = job.observation_circuits ?? []
  const [observationCircuits, setObservationCircuits] = useState<ObservationCircuitState[]>(() => emptyCircuits(savedCircuits))
  const [circuit2Enabled, setCircuit2Enabled] = useState(savedCircuits.some(circuit => circuit.circuit_number === 2))
  const [activeCircuit, setActiveCircuit] = useState<1 | 2>(1)

  const initialSystemType = apartmentJob ? 'heat_pump' : (job.systems?.system_type ?? '')
  const [linkedSystemId] = useState<string | null>(job.systems?.id ?? null)
  const [systemName, setSystemName] = useState(
    apartmentJob ? withApartmentDefault(job.systems?.group_name ?? job.systems?.name, 'Main') : (job.systems?.group_name ?? job.systems?.name ?? ''),
  )
  const [systemType, setSystemType] = useState(initialSystemType)
  const [servedAreas, setServedAreas] = useState(apartmentJob ? withApartmentDefault(job.systems?.served_areas, 'All') : (job.systems?.served_areas ?? ''))
  const [thermostatLocation, setThermostatLocation] = useState(apartmentJob ? withApartmentDefault(job.systems?.thermostat_location, 'Hallway') : (job.systems?.thermostat_location ?? ''))
  const [equipmentLocation, setEquipmentLocation] = useState(apartmentJob ? withApartmentDefault(job.systems?.equipment_location, 'Typical') : (job.systems?.equipment_location ?? ''))
  const [systemNotes, setSystemNotes] = useState(job.systems?.notes ?? '')
  const [sharedTonnage, setSharedTonnage] = useState(inferSharedTonnage(job))
  const [sharedRefrigerant, setSharedRefrigerant] = useState(inferSharedRefrigerant(job))
  const parsedControls = parseRtuControls(job.systems?.controls_notes)
  const [rtuControls, setRtuControls] = useState<string[]>(parsedControls.controls)
  const [rtuControlsNote, setRtuControlsNote] = useState(parsedControls.note)
  const [components, setComponents] = useState<ObservedComponentState[]>(initialComponentsForJob(job, initialSystemType))

  useEffect(() => {
    if (!circuit2Enabled && activeCircuit === 2) setActiveCircuit(1)
  }, [activeCircuit, circuit2Enabled])

  const deltaT = formatDelta(tempReturn, tempSupply, tstatMode)
  const activeCircuitState = observationCircuits.find(circuit => circuit.circuit_number === activeCircuit) ?? observationCircuits[0]
  const usesSharedRefrigerant = systemType === 'heat_pump' || systemType === 'ac_furnace'
  const usesSharedTonnage = systemType === 'heat_pump' || systemType === 'ac_furnace'

  function handleSystemTypeChange(nextSystemType: string) {
    setSystemType(nextSystemType)
    setComponents(current => remapComponentsForSystemType(current, nextSystemType))
  }

  function updateComponent(index: number, patch: Partial<ObservedComponentState>) {
    setComponents(current => current.map((component, i) => i === index ? { ...component, ...patch } : component))
  }

  function updateCircuit(field: keyof Omit<ObservationCircuitState, 'id' | 'circuit_number'>, value: string) {
    setObservationCircuits(current => current.map(circuit => (
      circuit.circuit_number === activeCircuit ? { ...circuit, [field]: value } : circuit
    )))
  }

  function toggleRtuControl(control: string) {
    setRtuControls(current => current.includes(control) ? current.filter(item => item !== control) : [...current, control])
  }

  async function persist(nextHref: string) {
    if (!tstatMode || !tstatFan) {
      setError('Select thermostat mode and fan before continuing.')
      setTab('readings')
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await uploadJobPhotos(job.id, 'observation', observationFiles)
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'Photo upload failed')
        return
      }

      const obsResult = await saveObservations(job.id, {
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

      if (obsResult.error) {
        setError(obsResult.error)
        return
      }

      const snapshotComponents = components.map(component => {
        if (systemType === 'heat_pump') return { ...component, tonnage: sharedTonnage, refrigerant_type: sharedRefrigerant }
        if (systemType === 'ac_furnace' && (component.subtype === 'CU' || component.subtype === 'Coil')) {
          return { ...component, tonnage: sharedTonnage, refrigerant_type: sharedRefrigerant }
        }
        if (systemType === 'ac_furnace' && component.subtype === 'Furnace') {
          return { ...component, refrigerant_type: '', tonnage: '' }
        }
        return component
      })

      if (systemType || linkedSystemId || components.some(component => component.make || component.model || component.serial_number)) {
        const sysResult = await saveObservedSystemSnapshot(job.id, {
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

        if (sysResult.error) {
          setError(sysResult.error)
          return
        }
      }

      router.push(nextHref)
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-lg">
          {([
            { key: 'readings', label: 'Readings' },
            { key: 'system', label: 'System' },
          ] as const).map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={[
                'flex-1 py-3 text-sm font-semibold',
                tab === item.key
                  ? 'border-b-2 border-blue-700 text-blue-700'
                  : 'border-b-2 border-transparent text-stone-500',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
          <h1 className="m-0 text-[28px] font-medium leading-tight tracking-[-0.03em] text-[#1a1a18]">
            {tab === 'readings' ? 'What is the system doing?' : 'What is installed?'}
          </h1>

          {tab === 'readings' && (
            <>
              <Card>
                <div className="flex flex-col gap-4">
                  <ChoiceGroup
                    label="Mode"
                    value={tstatMode}
                    onChange={setTstatMode}
                    options={[
                      { value: 'cool', label: 'Cool', tone: 'cool' },
                      { value: 'off', label: 'Off', tone: 'neutral' },
                      { value: 'heat', label: 'Heat', tone: 'heat' },
                      { value: 'em_heat', label: 'EM', tone: 'alert' },
                    ]}
                  />
                  <ChoiceGroup
                    label="Fan"
                    value={tstatFan}
                    onChange={setTstatFan}
                    options={[
                      { value: 'auto', label: 'Auto' },
                      { value: 'on', label: 'On' },
                    ]}
                  />
                </div>
              </Card>

              <Card>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Temperatures
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ReadingField label="Outdoor" value={tempOutdoor} onChange={setTempOutdoor} suffix="F" />
                  <ReadingField label="Return" value={tempReturn} onChange={setTempReturn} suffix="F" />
                  <ReadingField label="Supply" value={tempSupply} onChange={setTempSupply} suffix="F" />
                  <ReadingField label="Delta" value={deltaT} placeholder="—" suffix="F" readOnly />
                </div>
              </Card>

              {showPressures || observationCircuits.some(circuitHasValues) ? (
                <Card>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Pressures
                    </div>
                    {circuit2Enabled && (
                      <button
                        type="button"
                        onClick={() => setActiveCircuit(activeCircuit === 1 ? 2 : 1)}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700"
                      >
                        Circuit {activeCircuit === 1 ? '1 → 2' : '2 → 1'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ReadingField label="Suction" value={activeCircuitState?.suction_pressure ?? ''} onChange={value => updateCircuit('suction_pressure', value)} suffix="PSI" />
                    <ReadingField label="SLT" value={activeCircuitState?.suction_line_temp ?? ''} onChange={value => updateCircuit('suction_line_temp', value)} suffix="F" />
                    <ReadingField label="Liquid" value={activeCircuitState?.liquid_pressure ?? ''} onChange={value => updateCircuit('liquid_pressure', value)} suffix="PSI" />
                    <ReadingField label="LLT" value={activeCircuitState?.liquid_line_temp ?? ''} onChange={value => updateCircuit('liquid_line_temp', value)} suffix="F" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCircuit2Enabled(current => !current)}
                    className="mt-3 w-full rounded-xl border border-stone-300 bg-white py-2 text-sm font-semibold text-stone-700"
                  >
                    {circuit2Enabled ? 'Remove circuit 2' : 'Add circuit 2'}
                  </button>
                </Card>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPressures(true)}
                  className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-3 text-left text-sm font-semibold text-stone-600"
                >
                  Add refrigerant pressures
                </button>
              )}

              <Card>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Photos
                </div>
                <PhotoSlot label="Observation photos" files={observationFiles} onChange={setObservationFiles} />
              </Card>

              <Card>
                <SharedLabel>Notes</SharedLabel>
                <textarea
                  value={observationNotes}
                  onChange={event => setObservationNotes(event.target.value)}
                  rows={4}
                  placeholder="What you saw, what the customer said, what changed"
                  className={`${fieldControlClass} min-h-[120px] resize-y leading-relaxed`}
                />
              </Card>
            </>
          )}

          {tab === 'system' && (
            <>
              {!linkedSystemId && (
                <div className="rounded-2xl bg-stone-900 px-4 py-3 text-sm text-amber-100">
                  No equipment linked yet. Saving will create the system record from what you enter here.
                </div>
              )}

              {!apartmentJob && (
                <Card>
                  <div className="flex flex-col gap-3">
                    <div>
                      <SharedLabel>System Name</SharedLabel>
                      <input
                        value={systemName}
                        onChange={event => setSystemName(event.target.value)}
                        className={fieldControlClass}
                        placeholder="Front office HP-1"
                      />
                    </div>
                    <div>
                      <SharedLabel>System Type</SharedLabel>
                      <select
                        value={systemType}
                        onChange={event => handleSystemTypeChange(event.target.value)}
                        className={fieldControlClass}
                      >
                        <option value="">Select type</option>
                        {SYSTEM_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        <option value="ac_furnace">AC / Furnace</option>
                      </select>
                    </div>
                  </div>
                </Card>
              )}

              {(usesSharedTonnage || usesSharedRefrigerant) && (
                <Card>
                  <div className="flex flex-col gap-3">
                    {usesSharedTonnage && (
                      <div>
                        <SharedLabel>System Tonnage</SharedLabel>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={sharedTonnage}
                          onChange={event => setSharedTonnage(event.target.value)}
                          className={fieldControlClass}
                          placeholder="2.5"
                        />
                      </div>
                    )}
                    {usesSharedRefrigerant && (
                      <div>
                        <SharedLabel>System Refrigerant</SharedLabel>
                        <select
                          value={sharedRefrigerant}
                          onChange={event => setSharedRefrigerant(event.target.value)}
                          className={fieldControlClass}
                        >
                          <option value="">Select refrigerant</option>
                          {REFRIGERANT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {!apartmentJob && (
                <Card>
                  <div className="flex flex-col gap-3">
                    <div>
                      <SharedLabel>Served Areas</SharedLabel>
                      <input
                        value={servedAreas}
                        onChange={event => setServedAreas(event.target.value)}
                        className={fieldControlClass}
                        placeholder="Front office, lobby"
                      />
                    </div>
                    <div>
                      <SharedLabel>Thermostat Location</SharedLabel>
                      <input
                        value={thermostatLocation}
                        onChange={event => setThermostatLocation(event.target.value)}
                        className={fieldControlClass}
                        placeholder="Hallway"
                      />
                    </div>
                    <div>
                      <SharedLabel>Equipment Location</SharedLabel>
                      <input
                        value={equipmentLocation}
                        onChange={event => setEquipmentLocation(event.target.value)}
                        className={fieldControlClass}
                        placeholder="Roof curb, closet"
                      />
                    </div>
                  </div>
                </Card>
              )}

              <ComponentEditor
                components={components}
                systemType={systemType}
                updateComponent={updateComponent}
                renderModelInput={(index, component) => (
                  <OcrInput
                    value={component.model}
                    onChange={value => updateComponent(index, { model: value })}
                    placeholder="Model number"
                  />
                )}
                renderSerialInput={(index, component) => (
                  <OcrInput
                    value={component.serial_number}
                    onChange={value => updateComponent(index, { serial_number: value })}
                    placeholder="Serial number"
                  />
                )}
              />

              {systemType === 'rtu' && (
                <Card>
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    RTU Controls
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {RTU_CONTROL_OPTIONS.map(control => {
                      const active = rtuControls.includes(control)
                      return (
                        <button
                          key={control}
                          type="button"
                          onClick={() => toggleRtuControl(control)}
                          className={[
                            'min-h-[44px] rounded-xl border px-3 text-sm font-semibold',
                            active ? 'border-amber-700 bg-amber-100 text-amber-950' : 'border-stone-300 bg-white text-stone-700',
                          ].join(' ')}
                        >
                          {control}
                        </button>
                      )
                    })}
                  </div>
                  <SharedLabel>Controls Note</SharedLabel>
                  <textarea
                    value={rtuControlsNote}
                    onChange={event => setRtuControlsNote(event.target.value)}
                    rows={2}
                    className={`${fieldControlClass} min-h-[72px] resize-y`}
                    placeholder="Anything unusual about the controls package"
                  />
                </Card>
              )}

              <Card>
                <SharedLabel>System Notes</SharedLabel>
                <textarea
                  value={systemNotes}
                  onChange={event => setSystemNotes(event.target.value)}
                  rows={2}
                  className={`${fieldControlClass} min-h-[72px] resize-y`}
                  placeholder="Anything else to know about this system"
                />
              </Card>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 pb-2">
          <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        </div>
      )}

      <SpokeFooter>
        <Button type="button" onClick={() => persist(`/jobs/${job.id}`)} disabled={transitioning}>
          Hub
        </Button>
        <Button
          type="button"
          variant="primary"
          fullWidth
          onClick={() => persist(`/jobs/${job.id}/diagnose`)}
          disabled={transitioning}
        >
          {transitioning ? 'Saving…' : 'Save and select repair'}
        </Button>
      </SpokeFooter>
    </div>
  )
}
