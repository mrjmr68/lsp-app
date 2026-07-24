'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Job, ObservationCircuitState, ObservedComponentState } from '../types'
import { saveObservations, saveObservedSystemSnapshot } from '../actions'
import SegControl from '../components/SegControl'
import ReadingField from '../components/ReadingField'
import PhotoSlot from '../components/PhotoSlot'
import SharedLabel from '../components/SharedLabel'
import ComponentEditor from '../components/ComponentEditor'
import OcrInput from '../components/OcrInput'
import {
  REFRIGERANT_OPTIONS,
  SYSTEM_TYPE_OPTIONS,
} from '@/utils/hvac/systems'

const RTU_CONTROL_OPTIONS = ['Zone Controller', 'Economizer', 'Smoke Detector', 'VFD', 'BAS Interface']

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #ddd5bf',
  borderRadius: '18px',
  padding: '18px',
  boxShadow: '0 14px 32px rgba(23, 25, 29, 0.08)',
  marginBottom: '18px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '14px',
  padding: '12px 10px',
  borderRadius: '12px',
  border: '1px solid #d3d1c7',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
}

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
  return { ...template, make: '', model: '', serial_number: '', tonnage: '', refrigerant_type: '', metering_device: '', heating_capacity_btu: '' }
}

function mapSystemToComponent(system: any, fallbackKey: string): ObservedComponentState {
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
    const match = existing.find(c => c.system_subtype === template.subtype)
      ?? (job.systems?.system_subtype === template.subtype ? job.systems : null)
    return match ? mapSystemToComponent(match, template.key) : emptyComponent(template)
  })
}

function remapComponentsForSystemType(current: ObservedComponentState[], systemType: string) {
  const templates = componentTemplate(systemType)
  return templates.map(template => {
    const existing = current.find(c => c.subtype === template.subtype || c.key === template.key)
    if (existing) return { ...existing, key: template.key, label: template.label, subtype: template.subtype }
    return emptyComponent(template)
  })
}

function inferSharedTonnage(job: Job) {
  const candidates = (job.system_components ?? []).map(c => c.tonnage).filter((v): v is number => v != null)
  if (candidates.length > 0) return String(candidates[0])
  return job.systems?.tonnage != null ? String(job.systems.tonnage) : ''
}

function inferSharedRefrigerant(job: Job) {
  const candidates = (job.system_components ?? []).map(c => c.refrigerant_type).filter((v): v is string => !!v)
  return candidates[0] ?? job.systems?.refrigerant_type ?? ''
}

function parseRtuControls(controlsNotes: string | null | undefined) {
  if (!controlsNotes) return { controls: [] as string[], note: '' }
  const lines = controlsNotes.split('\n')
  const controlsLine = lines.find(l => l.startsWith('Controls:'))
  const notesLine = lines.find(l => l.startsWith('Notes:'))
  return {
    controls: controlsLine ? controlsLine.replace('Controls:', '').split(',').map(i => i.trim()).filter(Boolean) : [],
    note: notesLine ? notesLine.replace('Notes:', '').trim() : '',
  }
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function formatDelta(tempReturn: string, tempSupply: string, tstatMode: string) {
  const r = parseFloat(tempReturn)
  const s = parseFloat(tempSupply)
  if (Number.isNaN(r) || Number.isNaN(s)) return ''
  const raw = tstatMode === 'heat' || tstatMode === 'em_heat' ? s - r : r - s
  return String(Math.round(raw * 10) / 10)
}

function isApartmentJob(job: Job) {
  const t = job.units?.unit_type?.trim().toLowerCase() ?? ''
  const n = job.units?.name?.trim().toLowerCase() ?? ''
  return !!job.units && t !== 'main' && n !== 'default'
}

function withApartmentDefault(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

export default function ObserveClient({ job }: { job: Job }) {
  const router = useRouter()
  const [tab, setTab] = useState<'readings' | 'system'>('readings')
  const [transitioning, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const apartmentJob = isApartmentJob(job)
  const isApartmentContext = apartmentJob

  // Readings state
  const [tstatMode, setTstatMode] = useState(job.tstat_mode ?? '')
  const [tstatFan, setTstatFan] = useState(job.tstat_fan ?? '')
  const [tempOutdoor, setTempOutdoor] = useState(job.temp_outdoor != null ? String(job.temp_outdoor) : '')
  const [tempOutdoorAuto, setTempOutdoorAuto] = useState<number | null>(job.temp_outdoor_auto ?? null)
  const [tempReturn, setTempReturn] = useState(job.temp_return != null ? String(job.temp_return) : '')
  const [tempSupply, setTempSupply] = useState(job.temp_supply != null ? String(job.temp_supply) : '')
  const [observationNotes, setObservationNotes] = useState(job.arrival_notes ?? '')
  const [observationFiles, setObservationFiles] = useState<File[]>([])
  const [weatherLoading, setWeatherLoading] = useState(false)

  // Circuit state
  const savedCircuits = job.observation_circuits ?? []
  const [observationCircuits, setObservationCircuits] = useState<ObservationCircuitState[]>(
    ([1, 2] as const).map(n => {
      const match = savedCircuits.find(c => c.circuit_number === n)
      return match
        ? { id: match.id, circuit_number: n, suction_pressure: match.suction_pressure != null ? String(match.suction_pressure) : '', suction_line_temp: match.suction_line_temp != null ? String(match.suction_line_temp) : '', liquid_pressure: match.liquid_pressure != null ? String(match.liquid_pressure) : '', liquid_line_temp: match.liquid_line_temp != null ? String(match.liquid_line_temp) : '' }
        : { circuit_number: n, suction_pressure: '', suction_line_temp: '', liquid_pressure: '', liquid_line_temp: '' }
    })
  )
  const [circuit2Enabled, setCircuit2Enabled] = useState(savedCircuits.some(c => c.circuit_number === 2))
  const [activeCircuit, setActiveCircuit] = useState<1 | 2>(1)

  // System state
  const initialSystemType = apartmentJob ? 'heat_pump' : (job.systems?.system_type ?? '')
  const [linkedSystemId, setLinkedSystemId] = useState<string | null>(job.systems?.id ?? null)
  const [systemName, setSystemName] = useState(
    apartmentJob ? withApartmentDefault(job.systems?.group_name ?? job.systems?.name, 'Main') : (job.systems?.group_name ?? job.systems?.name ?? '')
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

  // Weather auto-fill
  useEffect(() => {
    if (tempOutdoor) return
    if (!job.arrived_at) return
    // Try weather API using a rough lat/lng if available
    // The original used arrivedLat/Lng which was client-only state
    // For the page-based architecture, weather auto-fill would need GPS stored on the job
    // For now, skip auto-fill since the field is editable
  }, [tempOutdoor, job.arrived_at])

  useEffect(() => {
    if (!circuit2Enabled && activeCircuit === 2) setActiveCircuit(1)
  }, [activeCircuit, circuit2Enabled])

  const deltaT = formatDelta(tempReturn, tempSupply, tstatMode)
  const activeCircuitState = observationCircuits.find(c => c.circuit_number === activeCircuit) ?? observationCircuits[0]
  const usesSharedRefrigerant = systemType === 'heat_pump' || systemType === 'ac_furnace'
  const usesSharedTonnage = systemType === 'heat_pump' || systemType === 'ac_furnace'

  function handleSystemTypeChange(nextSystemType: string) {
    setSystemType(nextSystemType)
    setComponents(current => remapComponentsForSystemType(current, nextSystemType))
  }

  function updateComponent(index: number, patch: Partial<ObservedComponentState>) {
    setComponents(current => current.map((c, i) => i === index ? { ...c, ...patch } : c))
  }

  function updateCircuit(field: keyof Omit<ObservationCircuitState, 'id' | 'circuit_number'>, value: string) {
    setObservationCircuits(current => current.map(c => c.circuit_number === activeCircuit ? { ...c, [field]: value } : c))
  }

  function toggleRtuControl(control: string) {
    setRtuControls(current => current.includes(control) ? current.filter(i => i !== control) : [...current, control])
  }

  async function handleNext() {
    if (!tstatMode || !tstatFan) {
      setError('Select thermostat mode and fan setting before continuing.')
      return
    }

    setError(null)
    startTransition(async () => {
      // Save observations
      const obsResult = await saveObservations(job.id, {
        tstat_mode: tstatMode,
        tstat_fan: tstatFan,
        temp_outdoor: parseOptionalNumber(tempOutdoor),
        temp_outdoor_auto: tempOutdoorAuto,
        temp_return: parseOptionalNumber(tempReturn),
        temp_supply: parseOptionalNumber(tempSupply),
        arrival_notes: observationNotes,
        circuits: observationCircuits
          .filter(c => c.circuit_number === 1 || circuit2Enabled)
          .map(c => ({
            id: c.id ?? null,
            circuit_number: c.circuit_number,
            suction_pressure: parseOptionalNumber(c.suction_pressure),
            suction_line_temp: parseOptionalNumber(c.suction_line_temp),
            liquid_pressure: parseOptionalNumber(c.liquid_pressure),
            liquid_line_temp: parseOptionalNumber(c.liquid_line_temp),
          })),
      })

      if (obsResult.error) {
        setError(obsResult.error)
        return
      }

      // Save system snapshot
      const snapshotComponents = components.map(c => {
        if (systemType === 'heat_pump') return { ...c, tonnage: sharedTonnage, refrigerant_type: sharedRefrigerant }
        if (systemType === 'ac_furnace' && (c.subtype === 'CU' || c.subtype === 'Coil')) return { ...c, tonnage: sharedTonnage, refrigerant_type: sharedRefrigerant }
        if (systemType === 'ac_furnace' && c.subtype === 'Furnace') return { ...c, refrigerant_type: '', tonnage: '' }
        return c
      })

      if (systemType || linkedSystemId || components.some(c => c.make || c.model || c.serial_number)) {
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

      router.push(`/jobs/${job.id}/diagnose`)
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ flexShrink: 0, display: 'flex', gap: '0', background: '#fff', borderBottom: '1px solid #e2e1da' }}>
        {(['readings', 'system'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: 'transparent',
              borderBottom: tab === t ? '2px solid #185fa5' : '2px solid transparent',
              fontSize: '13px',
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? '#185fa5' : '#888780',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: '760px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {tab === 'readings' && (
          <>
            {/* Mode/Fan */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                <SegControl
                  label="Mode"
                  value={tstatMode}
                  onChange={setTstatMode}
                  options={[
                    { value: 'cool', label: 'Cool', activeColor: { bg: '#185fa5', fg: '#fff' } },
                    { value: 'off', label: 'Off', activeColor: { bg: '#5f5e5a', fg: '#fff' } },
                    { value: 'heat', label: 'Heat', activeColor: { bg: '#854f0b', fg: '#fff' } },
                    { value: 'em_heat', label: 'EM', activeColor: { bg: '#a32d2d', fg: '#fff' } },
                  ]}
                />
                <SegControl
                  label="Fan"
                  value={tstatFan}
                  onChange={setTstatFan}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'on', label: 'On' },
                  ]}
                />
              </div>
            </div>

            {/* Temps */}
            <div style={cardStyle}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                Readings
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                <ReadingField label="Outdoor" value={tempOutdoor} onChange={setTempOutdoor} suffix="F" />
                <ReadingField label="Return" value={tempReturn} onChange={setTempReturn} suffix="F" />
                <ReadingField label="Supply" value={tempSupply} onChange={setTempSupply} suffix="F" />
                <ReadingField label="Delta" value={deltaT} placeholder="-" suffix="F" readOnly />
              </div>

              {circuit2Enabled && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveCircuit(activeCircuit === 1 ? 2 : 1)}
                    style={{
                      padding: '5px 10px', borderRadius: '999px', border: '1px solid #d3d1c7',
                      background: '#fff', color: '#3a3329', fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: '11px', lineHeight: 1.1,
                    }}
                  >
                    {activeCircuit === 1 ? 'Show Circuit 2' : 'Show Circuit 1'}
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                <ReadingField label="Suction" value={activeCircuitState?.suction_pressure ?? ''} onChange={v => updateCircuit('suction_pressure', v)} suffix="PSI" />
                <ReadingField label="SLT" value={activeCircuitState?.suction_line_temp ?? ''} onChange={v => updateCircuit('suction_line_temp', v)} suffix="F" />
                <ReadingField label="Liquid" value={activeCircuitState?.liquid_pressure ?? ''} onChange={v => updateCircuit('liquid_pressure', v)} suffix="PSI" />
                <ReadingField label="LLT" value={activeCircuitState?.liquid_line_temp ?? ''} onChange={v => updateCircuit('liquid_line_temp', v)} suffix="F" />
              </div>

              <button
                type="button"
                onClick={() => setCircuit2Enabled(c => !c)}
                style={{
                  width: '100%', marginTop: '8px', padding: '5px 12px', borderRadius: '8px',
                  border: '1px solid #d3c089', background: circuit2Enabled ? '#fbf4e2' : '#fff',
                  color: '#7d5f1d', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '12px', lineHeight: 1.2,
                }}
              >
                {circuit2Enabled ? 'Remove Circuit 2' : 'Add Circuit 2'}
              </button>
            </div>

            {/* Notes + Photos */}
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                    Notes
                  </div>
                  <textarea
                    value={observationNotes}
                    onChange={e => setObservationNotes(e.target.value)}
                    rows={6}
                    placeholder="Talking to client, what you saw, what changed..."
                    style={{ ...inputStyle, minHeight: 156, resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                    Photos
                  </div>
                  <PhotoSlot label="Observation photos" files={observationFiles} onChange={setObservationFiles} />
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'system' && (
          <div style={{
            ...cardStyle,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,243,233,0.98) 100%)',
            borderColor: '#d7cfb7',
          }}>
            {!linkedSystemId && (
              <div style={{ background: '#1f2125', border: '1px solid #2f3239', borderRadius: '14px', padding: '12px 14px', fontSize: '13px', color: '#f1e2b8', marginBottom: '14px' }}>
                No equipment set is linked yet. Saving this step will create and attach the system details below.
              </div>
            )}

            {!isApartmentContext && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <SharedLabel>System Name</SharedLabel>
                  <input value={systemName} onChange={e => setSystemName(e.target.value)} style={inputStyle} placeholder="Front office HP-1 / RTU-2" />
                </div>
                <div>
                  <SharedLabel>System Type</SharedLabel>
                  <select value={systemType} onChange={e => handleSystemTypeChange(e.target.value)} style={inputStyle}>
                    <option value="">Select type</option>
                    {SYSTEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    <option value="ac_furnace">AC / Furnace</option>
                  </select>
                </div>
              </div>
            )}

            {(usesSharedTonnage || usesSharedRefrigerant) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                {usesSharedTonnage && (
                  <div>
                    <SharedLabel>System Tonnage</SharedLabel>
                    <input type="number" step="0.5" value={sharedTonnage} onChange={e => setSharedTonnage(e.target.value)} style={inputStyle} placeholder="2.5" />
                  </div>
                )}
                {usesSharedRefrigerant && (
                  <div>
                    <SharedLabel>System Refrigerant</SharedLabel>
                    <select value={sharedRefrigerant} onChange={e => setSharedRefrigerant(e.target.value)} style={inputStyle}>
                      <option value="">Select refrigerant</option>
                      {REFRIGERANT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {!isApartmentContext && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <SharedLabel>Served Areas</SharedLabel>
                    <input value={servedAreas} onChange={e => setServedAreas(e.target.value)} style={inputStyle} placeholder="Front office, lobby, suite 200" />
                  </div>
                  <div>
                    <SharedLabel>Thermostat Location</SharedLabel>
                    <input value={thermostatLocation} onChange={e => setThermostatLocation(e.target.value)} style={inputStyle} placeholder="Hallway / office / break room" />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <SharedLabel>Equipment Location / Access</SharedLabel>
                  <input value={equipmentLocation} onChange={e => setEquipmentLocation(e.target.value)} style={inputStyle} placeholder="Roof curb, closet, above drop ceiling" />
                </div>
              </>
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
              <div style={{ border: '1px solid #ddd5bf', borderRadius: '14px', padding: '14px', background: '#fffdf8', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1f2329', marginBottom: '10px' }}>
                  RTU Controls / Add-ons
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {RTU_CONTROL_OPTIONS.map(control => {
                    const active = rtuControls.includes(control)
                    return (
                      <button
                        key={control}
                        type="button"
                        onClick={() => toggleRtuControl(control)}
                        style={{
                          padding: '7px 12px', borderRadius: '999px',
                          border: active ? '1px solid #d3b26a' : '1px solid #d3d1c7',
                          background: active ? '#f4ead1' : '#fff',
                          color: active ? '#26211a' : '#5f5e5a',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
                          fontWeight: active ? 700 : 500,
                        }}
                      >
                        {control}
                      </button>
                    )
                  })}
                </div>
                <div>
                  <SharedLabel>Controls Note</SharedLabel>
                  <textarea value={rtuControlsNote} onChange={e => setRtuControlsNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Anything unusual about the controls package" />
                </div>
              </div>
            )}

            <div>
              <SharedLabel>System Notes</SharedLabel>
              <textarea value={systemNotes} onChange={e => setSystemNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Anything else to know about this system" />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <div style={{ background: '#fcebeb', border: '1px solid #f7c1c1', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: '#a32d2d', marginBottom: '8px' }}>
            {error}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid #e2e1da', padding: '12px 16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => router.push(`/jobs/${job.id}/arrive`)}
          style={{ padding: '11px 20px', borderRadius: '8px', border: '1px solid #d3d1c7', background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {'<- Back'}
        </button>
        <button
          onClick={handleNext}
          disabled={transitioning}
          style={{
            flex: 1, padding: '11px', borderRadius: '8px', border: 'none',
            background: transitioning ? '#b4b2a9' : '#185fa5',
            color: '#fff', fontSize: '13px', fontWeight: 600,
            cursor: transitioning ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {transitioning ? 'Saving...' : 'Diagnose ->'}
        </button>
      </div>
    </div>
  )
}
