'use client'

import { useEffect, useState } from 'react'
import { Job, ObservationCircuitState, ObservedComponentState } from './types'
import {
  MAKE_OPTIONS,
  METERING_OPTIONS,
  REFRIGERANT_OPTIONS,
  SYSTEM_TYPE_OPTIONS,
} from '@/utils/hvac/systems'

const PRESSURES: Record<string, { suction: string; liquid: string }> = {
  'R-410A': { suction: '115-130 PSI', liquid: '380-430 PSI' },
  'R-22': { suction: '58-68 PSI', liquid: '225-265 PSI' },
  'R-32': { suction: '170-195 PSI', liquid: '480-540 PSI' },
}

const SUPERHEAT: Record<string, { txv: string; fixed: string }> = {
  'R-410A': { txv: '8-12 F', fixed: '10-18 F' },
  'R-22': { txv: '8-12 F', fixed: '10-18 F' },
  'R-32': { txv: '6-10 F', fixed: '10-15 F' },
}

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

const centeredInputStyle: React.CSSProperties = {
  ...inputStyle,
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '16px',
}

export interface ObservationWorkspaceProps {
  job: Job
  arrivedLat: number | null
  arrivedLng: number | null
  tstatMode: string
  setTstatMode: (value: string) => void
  tstatFan: string
  setTstatFan: (value: string) => void
  tempOutdoor: string
  setTempOutdoor: (value: string) => void
  tempOutdoorAuto: number | null
  setTempOutdoorAuto: (value: number | null) => void
  tempReturn: string
  setTempReturn: (value: string) => void
  tempSupply: string
  setTempSupply: (value: string) => void
  observationNotes: string
  setObservationNotes: (value: string) => void
  observationFiles: File[]
  setObservationFiles: (files: File[]) => void
  observationCircuits: ObservationCircuitState[]
  setObservationCircuits: React.Dispatch<React.SetStateAction<ObservationCircuitState[]>>
  activeCircuit: 1 | 2
  setActiveCircuit: (value: 1 | 2) => void
  circuit2Enabled: boolean
  setCircuit2Enabled: React.Dispatch<React.SetStateAction<boolean>>
  linkedSystemId: string | null
  systemName: string
  setSystemName: (value: string) => void
  systemType: string
  setSystemType: (value: string) => void
  servedAreas: string
  setServedAreas: (value: string) => void
  thermostatLocation: string
  setThermostatLocation: (value: string) => void
  equipmentLocation: string
  setEquipmentLocation: (value: string) => void
  systemNotes: string
  setSystemNotes: (value: string) => void
  sharedTonnage: string
  setSharedTonnage: (value: string) => void
  sharedRefrigerant: string
  setSharedRefrigerant: (value: string) => void
  rtuControls: string[]
  setRtuControls: React.Dispatch<React.SetStateAction<string[]>>
  rtuControlsNote: string
  setRtuControlsNote: (value: string) => void
  components: ObservedComponentState[]
  setComponents: React.Dispatch<React.SetStateAction<ObservedComponentState[]>>
  observeSystemError: string | null
  showSystemCard: boolean
  showRulesOfThumb: boolean
}

function SegControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string; activeColor?: { bg: string; fg: string } }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#6a6356', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(option => {
          const active = value === option.value
          const colors = option.activeColor ?? { bg: '#1f2329', fg: '#f8f3e6' }
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                minWidth: 62,
                padding: '11px 14px',
                borderRadius: '12px',
                border: active ? '1px solid transparent' : '1px solid #cfc8b8',
                background: active ? colors.bg : '#fff',
                color: active ? colors.fg : '#2a2d33',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SharedLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>
      {children}
    </label>
  )
}

function ReadingField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  readOnly = false,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  suffix?: string
  readOnly?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#6f685b', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          value={value}
          onChange={event => onChange?.(event.target.value)}
          placeholder={placeholder ?? '-'}
          readOnly={readOnly}
          style={{
            ...centeredInputStyle,
            background: readOnly ? '#f6f1e6' : '#fff',
            color: value ? '#1b1f25' : '#8a8378',
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#7a7367', fontWeight: 700 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function PhotoSlot({
  label,
  files,
  onChange,
}: {
  label: string
  files: File[]
  onChange: (files: File[]) => void
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      background: '#fbf8ef',
      border: '1px dashed #b7ae98',
      borderRadius: '14px',
      padding: '14px 16px',
      cursor: 'pointer',
      color: '#403a31',
    }}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={event => onChange(event.target.files ? Array.from(event.target.files) : [])}
      />
      <div>
        <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#716a5e', marginTop: '3px' }}>
          {files.length > 0 ? `${files.length} selected` : 'Tap to add or update'}
        </div>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#8b6a26' }}>Add</span>
    </label>
  )
}

function systemTypeLabel(systemType: string) {
  if (!systemType) return 'System'
  if (systemType === 'ac_furnace') return 'AC / Furnace'
  return systemType.replace(/_/g, ' ')
}

function formatDelta(tempReturn: string, tempSupply: string, tstatMode: string) {
  const returnValue = parseFloat(tempReturn)
  const supplyValue = parseFloat(tempSupply)
  if (Number.isNaN(returnValue) || Number.isNaN(supplyValue)) return ''
  const rawDelta = tstatMode === 'heat' || tstatMode === 'em_heat'
    ? supplyValue - returnValue
    : returnValue - supplyValue
  return String(Math.round(rawDelta * 10) / 10)
}

function asDisplayValue(value: string) {
  return value || '-'
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid #ead9ab', borderRadius: '14px', padding: '12px 14px' }}>
      <div style={{ fontSize: '11px', color: '#6f685b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2329' }}>{value}</div>
    </div>
  )
}

function ComponentEditor({
  components,
  systemType,
  updateComponent,
}: {
  components: ObservedComponentState[]
  systemType: string
  updateComponent: (index: number, patch: Partial<ObservedComponentState>) => void
}) {
  if (components.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
      {components.map((component, index) => {
        const shareTonnage = systemType === 'heat_pump' || (systemType === 'ac_furnace' && (component.subtype === 'CU' || component.subtype === 'Coil'))
        const shareRefrigerant = systemType === 'heat_pump' || (systemType === 'ac_furnace' && component.subtype !== 'Furnace')
        const showMetering = component.subtype !== 'Furnace'

        return (
          <div key={`${component.key}-${component.subtype}`} style={{ border: '1px solid #ddd5bf', borderRadius: '14px', padding: '14px', background: '#fffdf8' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1f2329', marginBottom: '10px' }}>
              {component.label}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <div>
                <SharedLabel>Make</SharedLabel>
                <select value={component.make} onChange={event => updateComponent(index, { make: event.target.value })} style={inputStyle}>
                  <option value="">Select make</option>
                  {MAKE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <SharedLabel>Model</SharedLabel>
                <input value={component.model} onChange={event => updateComponent(index, { model: event.target.value })} style={inputStyle} placeholder="Model number" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <div>
                <SharedLabel>Serial Number</SharedLabel>
                <input value={component.serial_number} onChange={event => updateComponent(index, { serial_number: event.target.value })} style={inputStyle} placeholder="Serial number" />
              </div>
              {component.subtype === 'Furnace' ? (
                <div>
                  <SharedLabel>BTU Rating</SharedLabel>
                  <input type="number" value={component.heating_capacity_btu} onChange={event => updateComponent(index, { heating_capacity_btu: event.target.value })} style={inputStyle} placeholder="80000" />
                </div>
              ) : !shareTonnage ? (
                <div>
                  <SharedLabel>Tonnage</SharedLabel>
                  <input type="number" step="0.5" value={component.tonnage} onChange={event => updateComponent(index, { tonnage: event.target.value })} style={inputStyle} placeholder="2.5" />
                </div>
              ) : <div />}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
              {!shareRefrigerant && component.subtype !== 'Furnace' && (
                <div>
                  <SharedLabel>Refrigerant</SharedLabel>
                  <select value={component.refrigerant_type} onChange={event => updateComponent(index, { refrigerant_type: event.target.value })} style={inputStyle}>
                    <option value="">Select refrigerant</option>
                    {REFRIGERANT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              )}
              {showMetering && (
                <div>
                  <SharedLabel>Metering Device</SharedLabel>
                  <select value={component.metering_device} onChange={event => updateComponent(index, { metering_device: event.target.value })} style={inputStyle}>
                    <option value="">Select metering</option>
                    {METERING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReadingsCard({
  weatherLoading,
  tempOutdoor,
  setTempOutdoor,
  tempReturn,
  setTempReturn,
  tempSupply,
  setTempSupply,
  deltaT,
  activeCircuit,
  setActiveCircuit,
  circuit2Enabled,
  toggleCircuitTwo,
  activeCircuitState,
  updateCircuit,
}: {
  weatherLoading: boolean
  tempOutdoor: string
  setTempOutdoor: (value: string) => void
  tempReturn: string
  setTempReturn: (value: string) => void
  tempSupply: string
  setTempSupply: (value: string) => void
  deltaT: string
  activeCircuit: 1 | 2
  setActiveCircuit: (value: 1 | 2) => void
  circuit2Enabled: boolean
  toggleCircuitTwo: () => void
  activeCircuitState: ObservationCircuitState
  updateCircuit: (field: keyof Omit<ObservationCircuitState, 'id' | 'circuit_number'>, value: string) => void
}) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
          Readings
        </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '8px' }}>
        <ReadingField label={`Outdoor${weatherLoading ? ' *' : ''}`} value={tempOutdoor} onChange={setTempOutdoor} suffix="F" />
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
              padding: '5px 10px',
              borderRadius: '999px',
              border: '1px solid #d3d1c7',
              background: '#fff',
              color: '#3a3329',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '11px',
              lineHeight: 1.1,
            }}
          >
            {activeCircuit === 1 ? 'Show Circuit 2' : 'Show Circuit 1'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
        <ReadingField label="Suction" value={activeCircuitState?.suction_pressure ?? ''} onChange={value => updateCircuit('suction_pressure', value)} suffix="PSI" />
        <ReadingField label="SLT" value={activeCircuitState?.suction_line_temp ?? ''} onChange={value => updateCircuit('suction_line_temp', value)} suffix="F" />
        <ReadingField label="Liquid" value={activeCircuitState?.liquid_pressure ?? ''} onChange={value => updateCircuit('liquid_pressure', value)} suffix="PSI" />
        <ReadingField label="LLT" value={activeCircuitState?.liquid_line_temp ?? ''} onChange={value => updateCircuit('liquid_line_temp', value)} suffix="F" />
      </div>

      <button
        type="button"
        onClick={toggleCircuitTwo}
        style={{
          width: '100%',
          marginTop: '8px',
          padding: '5px 12px',
          borderRadius: '8px',
          border: '1px solid #d3c089',
          background: circuit2Enabled ? '#fbf4e2' : '#fff',
          color: '#7d5f1d',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '12px',
          lineHeight: 1.2,
        }}
      >
        {circuit2Enabled ? 'Remove Circuit 2' : 'Add Circuit 2'}
      </button>
    </div>
  )
}

export default function ObservationWorkspace(props: ObservationWorkspaceProps) {
  const {
    job,
    arrivedLat,
    arrivedLng,
    tstatMode,
    setTstatMode,
    tstatFan,
    setTstatFan,
    tempOutdoor,
    setTempOutdoor,
    tempOutdoorAuto,
    setTempOutdoorAuto,
    tempReturn,
    setTempReturn,
    tempSupply,
    setTempSupply,
    observationNotes,
    setObservationNotes,
    observationFiles,
    setObservationFiles,
    observationCircuits,
    setObservationCircuits,
    activeCircuit,
    setActiveCircuit,
    circuit2Enabled,
    setCircuit2Enabled,
    linkedSystemId,
    systemName,
    setSystemName,
    systemType,
    setSystemType,
    servedAreas,
    setServedAreas,
    thermostatLocation,
    setThermostatLocation,
    equipmentLocation,
    setEquipmentLocation,
    systemNotes,
    setSystemNotes,
    sharedTonnage,
    setSharedTonnage,
    sharedRefrigerant,
    setSharedRefrigerant,
    rtuControls,
    setRtuControls,
    rtuControlsNote,
    setRtuControlsNote,
    components,
    setComponents,
    observeSystemError,
    showSystemCard,
    showRulesOfThumb,
  } = props

  const normalizedUnitType = job.units?.unit_type?.trim().toLowerCase() ?? ''
  const normalizedUnitName = job.units?.name?.trim().toLowerCase() ?? ''
  const isApartmentContext = !!job.units && normalizedUnitType !== 'main' && normalizedUnitName !== 'default'
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(isApartmentContext)

  useEffect(() => {
    if (!arrivedLat || !arrivedLng || tempOutdoor) return
    setWeatherLoading(true)
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${arrivedLat}&longitude=${arrivedLng}&current=temperature_2m&temperature_unit=fahrenheit`)
      .then(response => response.json())
      .then(data => {
        const temperature = data?.current?.temperature_2m
        if (typeof temperature === 'number') {
          const rounded = Math.round(temperature)
          setTempOutdoor(String(rounded))
          setTempOutdoorAuto(rounded)
        }
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false))
  }, [arrivedLat, arrivedLng, setTempOutdoor, setTempOutdoorAuto, tempOutdoor])

  useEffect(() => {
    if (!circuit2Enabled && activeCircuit === 2) {
      setActiveCircuit(1)
    }
  }, [activeCircuit, circuit2Enabled, setActiveCircuit])
  const usesSharedRefrigerant = systemType === 'heat_pump' || systemType === 'ac_furnace'
  const usesSharedTonnage = systemType === 'heat_pump' || systemType === 'ac_furnace'
  const rulesComponent = components.find(component => component.subtype === 'AHU' || component.subtype === 'Coil')
    ?? components.find(component => component.metering_device)
    ?? components[0]
  const referenceRefrigerant = (usesSharedRefrigerant ? sharedRefrigerant : rulesComponent?.refrigerant_type) || job.systems?.refrigerant_type || 'R-410A'
  const referenceMetering = rulesComponent?.metering_device ?? job.systems?.metering_device ?? ''
  const deltaT = formatDelta(tempReturn, tempSupply, tstatMode)
  const activeCircuitState = observationCircuits.find(circuit => circuit.circuit_number === activeCircuit) ?? observationCircuits[0]
  const pressures = PRESSURES[referenceRefrigerant]
  const superheat = SUPERHEAT[referenceRefrigerant]
  const isTxv = referenceMetering.toLowerCase().includes('txv')

  function updateComponent(index: number, patch: Partial<ObservedComponentState>) {
    setComponents(current => current.map((component, currentIndex) => (
      currentIndex === index ? { ...component, ...patch } : component
    )))
  }

  function updateCircuit(field: keyof Omit<ObservationCircuitState, 'id' | 'circuit_number'>, value: string) {
    setObservationCircuits(current => current.map(circuit => (
      circuit.circuit_number === activeCircuit ? { ...circuit, [field]: value } : circuit
    )))
  }

  function toggleRtuControl(control: string) {
    setRtuControls(current => current.includes(control)
      ? current.filter(item => item !== control)
      : [...current, control])
  }

  function toggleCircuitTwo() {
    setCircuit2Enabled(current => !current)
  }

  return (
    <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
      {showSystemCard ? (
        <div style={{
          ...cardStyle,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,243,233,0.98) 100%)',
          borderColor: '#d7cfb7',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 12px',
            borderRadius: '16px',
            border: '1px solid #1f2329',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1f2329' }}>
              System
            </div>
            {!isApartmentContext && (
              <button
                type="button"
                onClick={() => setDetailsExpanded(current => !current)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '12px',
                  border: '1px solid #1f2329',
                  background: '#fff',
                  color: '#1f2329',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Details
              </button>
            )}
          </div>

          {!linkedSystemId && (
            <div style={{ background: '#1f2125', border: '1px solid #2f3239', borderRadius: '14px', padding: '12px 14px', fontSize: '13px', color: '#f1e2b8', marginBottom: '14px' }}>
              No equipment set is linked yet. Saving this step will create and attach the system details captured below.
            </div>
          )}

          {observeSystemError && (
            <div style={{ background: '#fcebeb', border: '1px solid #f4b7b7', borderRadius: '14px', padding: '12px 14px', color: '#8e1f1f', fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>
              {observeSystemError}
            </div>
          )}

          {(isApartmentContext || detailsExpanded) && (
            <div style={{ marginBottom: '18px' }}>
              {!isApartmentContext && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <SharedLabel>System Name</SharedLabel>
                    <input value={systemName} onChange={event => setSystemName(event.target.value)} style={inputStyle} placeholder="Front office HP-1 / RTU-2 / Apt 12 system" />
                  </div>
                  <div>
                    <SharedLabel>System Type</SharedLabel>
                    <select value={systemType} onChange={event => setSystemType(event.target.value)} style={inputStyle}>
                      <option value="">Select type</option>
                      {SYSTEM_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                      <input type="number" step="0.5" value={sharedTonnage} onChange={event => setSharedTonnage(event.target.value)} style={inputStyle} placeholder="2.5" />
                    </div>
                  )}
                  {usesSharedRefrigerant && (
                    <div>
                      <SharedLabel>System Refrigerant</SharedLabel>
                      <select value={sharedRefrigerant} onChange={event => setSharedRefrigerant(event.target.value)} style={inputStyle}>
                        <option value="">Select refrigerant</option>
                        {REFRIGERANT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                      <input value={servedAreas} onChange={event => setServedAreas(event.target.value)} style={inputStyle} placeholder="Front office, lobby, suite 200" />
                    </div>
                    <div>
                      <SharedLabel>Thermostat Location</SharedLabel>
                      <input value={thermostatLocation} onChange={event => setThermostatLocation(event.target.value)} style={inputStyle} placeholder="Hallway / office / break room" />
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <SharedLabel>Equipment Location / Access</SharedLabel>
                    <input value={equipmentLocation} onChange={event => setEquipmentLocation(event.target.value)} style={inputStyle} placeholder="Roof curb, closet, above drop ceiling" />
                  </div>
                </>
              )}

              <ComponentEditor
                components={components}
                systemType={systemType}
                updateComponent={updateComponent}
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
                            padding: '7px 12px',
                            borderRadius: '999px',
                            border: active ? '1px solid #d3b26a' : '1px solid #d3d1c7',
                            background: active ? '#f4ead1' : '#fff',
                            color: active ? '#26211a' : '#5f5e5a',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '12px',
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
                    <textarea value={rtuControlsNote} onChange={event => setRtuControlsNote(event.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Anything unusual about the controls package" />
                  </div>
                </div>
              )}

              <div>
                <SharedLabel>System Notes</SharedLabel>
                <textarea value={systemNotes} onChange={event => setSystemNotes(event.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder={`Anything else to know about this ${systemTypeLabel(systemType).toLowerCase()}`} />
              </div>
            </div>
          )}

          <div style={{
            borderTop: (isApartmentContext || detailsExpanded) ? '1px solid #e6dec7' : 'none',
            paddingTop: (isApartmentContext || detailsExpanded) ? '18px' : 0,
          }}>
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
        </div>
      ) : (
        <div style={{ ...cardStyle, paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Observation Context
              </div>
              <div style={{ fontSize: '13px', color: '#655f54', marginTop: '4px' }}>
                Review and adjust the readings captured before selecting the final diagnosis.
              </div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#8b6a26' }}>
              {linkedSystemId ? 'Linked to system' : 'No linked system yet'}
            </div>
          </div>

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
      )}

      <ReadingsCard
        weatherLoading={weatherLoading}
        tempOutdoor={tempOutdoor}
        setTempOutdoor={setTempOutdoor}
        tempReturn={tempReturn}
        setTempReturn={setTempReturn}
        tempSupply={tempSupply}
        setTempSupply={setTempSupply}
        deltaT={deltaT}
        activeCircuit={activeCircuit}
        setActiveCircuit={setActiveCircuit}
        circuit2Enabled={circuit2Enabled}
        toggleCircuitTwo={toggleCircuitTwo}
        activeCircuitState={activeCircuitState}
        updateCircuit={updateCircuit}
      />

      {showRulesOfThumb && pressures && (
        <div style={{ ...cardStyle, background: 'linear-gradient(180deg, #fffaf0 0%, #f8f2e3 100%)', borderColor: '#dcc88f' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Rules Of Thumb
          </div>
          <div style={{ fontSize: '13px', color: '#655f54', marginBottom: '12px' }}>
            {`Circuit ${activeCircuit}`} guidance for {referenceRefrigerant}{referenceMetering ? ` / ${referenceMetering}` : ''}.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <RuleRow label="Reference suction" value={pressures.suction} />
            <RuleRow label="Measured suction" value={asDisplayValue(activeCircuitState?.suction_pressure ?? '')} />
            <RuleRow label="Reference liquid" value={pressures.liquid} />
            <RuleRow label="Measured liquid" value={asDisplayValue(activeCircuitState?.liquid_pressure ?? '')} />
            <RuleRow label={isTxv ? 'Target superheat (TXV)' : 'Target superheat (fixed)'} value={isTxv ? (superheat?.txv ?? '-') : (superheat?.fixed ?? '-')} />
            <RuleRow label="Measured SLT / LLT" value={`${asDisplayValue(activeCircuitState?.suction_line_temp ?? '')} / ${asDisplayValue(activeCircuitState?.liquid_line_temp ?? '')}`} />
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Notes
            </div>
            <textarea
              value={observationNotes}
              onChange={event => setObservationNotes(event.target.value)}
              rows={6}
              placeholder="Talking to client, what you saw, what changed, anything the next step should know..."
              style={{ ...inputStyle, minHeight: 156, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Photos
            </div>
            <PhotoSlot label="Observation photos" files={observationFiles} onChange={setObservationFiles} />
            <div style={{ fontSize: '12px', color: '#716a5e', marginTop: '10px', lineHeight: 1.5 }}>
              These photos stay with the tech through Observe and Diagnose, then upload with the job close-out.
            </div>
            {tempOutdoorAuto !== null && !weatherLoading && (
              <div style={{ fontSize: '11px', color: '#8b6a26', marginTop: '10px' }}>
                Outdoor temperature was auto-filled from arrival GPS and can still be adjusted manually.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
