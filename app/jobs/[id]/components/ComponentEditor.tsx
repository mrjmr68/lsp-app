'use client'

import { ObservedComponentState } from '../types'
import SharedLabel from './SharedLabel'
import {
  MAKE_OPTIONS,
  METERING_OPTIONS,
  REFRIGERANT_OPTIONS,
} from '@/utils/hvac/systems'
import { fieldControlClass } from '@/utils/field/styles'

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
    <div className="flex flex-col gap-3">
      {components.map((component, index) => {
        const shareTonnage = systemType === 'heat_pump' || (systemType === 'ac_furnace' && (component.subtype === 'CU' || component.subtype === 'Coil'))
        const shareRefrigerant = systemType === 'heat_pump' || (systemType === 'ac_furnace' && component.subtype !== 'Furnace')
        const showMetering = component.subtype !== 'Furnace'

        return (
          <div key={`${component.key}-${component.subtype}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              {component.label}
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3">
              <div>
                <SharedLabel>Make</SharedLabel>
                <select
                  value={component.make}
                  onChange={event => updateComponent(index, { make: event.target.value })}
                  className={fieldControlClass}
                >
                  <option value="">Select make</option>
                  {MAKE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <SharedLabel>Model</SharedLabel>
                {renderModelInput ? renderModelInput(index, component) : (
                  <input
                    value={component.model}
                    onChange={event => updateComponent(index, { model: event.target.value })}
                    className={fieldControlClass}
                    placeholder="Model number"
                    autoCapitalize="characters"
                  />
                )}
              </div>
              <div>
                <SharedLabel>Serial Number</SharedLabel>
                {renderSerialInput ? renderSerialInput(index, component) : (
                  <input
                    value={component.serial_number}
                    onChange={event => updateComponent(index, { serial_number: event.target.value })}
                    className={fieldControlClass}
                    placeholder="Serial number"
                    autoCapitalize="characters"
                  />
                )}
              </div>
              {component.subtype === 'Furnace' ? (
                <div>
                  <SharedLabel>BTU Rating</SharedLabel>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={component.heating_capacity_btu}
                    onChange={event => updateComponent(index, { heating_capacity_btu: event.target.value })}
                    className={fieldControlClass}
                    placeholder="80000"
                  />
                </div>
              ) : !shareTonnage ? (
                <div>
                  <SharedLabel>Tonnage</SharedLabel>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={component.tonnage}
                    onChange={event => updateComponent(index, { tonnage: event.target.value })}
                    className={fieldControlClass}
                    placeholder="2.5"
                  />
                </div>
              ) : null}
              {!shareRefrigerant && component.subtype !== 'Furnace' && (
                <div>
                  <SharedLabel>Refrigerant</SharedLabel>
                  <select
                    value={component.refrigerant_type}
                    onChange={event => updateComponent(index, { refrigerant_type: event.target.value })}
                    className={fieldControlClass}
                  >
                    <option value="">Select refrigerant</option>
                    {REFRIGERANT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              )}
              {showMetering && (
                <div>
                  <SharedLabel>Metering Device</SharedLabel>
                  <select
                    value={component.metering_device}
                    onChange={event => updateComponent(index, { metering_device: event.target.value })}
                    className={fieldControlClass}
                  >
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
