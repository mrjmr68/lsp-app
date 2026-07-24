'use client'

import { ObservedComponentState } from '../types'
import SharedLabel from './SharedLabel'
import {
  MAKE_OPTIONS,
  METERING_OPTIONS,
  REFRIGERANT_OPTIONS,
} from '@/utils/hvac/systems'

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

export default function ComponentEditor({
  components,
  systemType,
  updateComponent,
  renderModelInput,
  renderSerialInput,
}: {
  components: ObservedComponentState[]
  systemType: string
  updateComponent: (index: number, patch: Partial<ObservedComponentState>) => void
  renderModelInput?: (index: number, component: ObservedComponentState) => React.ReactNode
  renderSerialInput?: (index: number, component: ObservedComponentState) => React.ReactNode
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
                {renderModelInput ? renderModelInput(index, component) : (
                  <input value={component.model} onChange={event => updateComponent(index, { model: event.target.value })} style={inputStyle} placeholder="Model number" />
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <div>
                <SharedLabel>Serial Number</SharedLabel>
                {renderSerialInput ? renderSerialInput(index, component) : (
                  <input value={component.serial_number} onChange={event => updateComponent(index, { serial_number: event.target.value })} style={inputStyle} placeholder="Serial number" />
                )}
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
