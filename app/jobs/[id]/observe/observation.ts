import { Job, ObservationCircuitState, ObservedComponentState } from '../types'

export function componentTemplate(systemType: string) {
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

export function emptyComponent(template: { key: string; label: string; subtype: string }): ObservedComponentState {
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

export function mapSystemToComponent(system: {
  id?: string
  name?: string | null
  system_subtype?: string | null
  make?: string | null
  model?: string | null
  serial_number?: string | null
  tonnage?: number | null
  refrigerant_type?: string | null
  metering_device?: string | null
  heating_capacity_btu?: number | null
}, fallbackKey: string): ObservedComponentState {
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

export function initialComponentsForJob(job: Job, systemType: string) {
  const templates = componentTemplate(systemType)
  const existing = job.system_components ?? []
  if (templates.length === 0) return []
  return templates.map(template => {
    const match = existing.find(component => component.system_subtype === template.subtype)
      ?? (job.systems?.system_subtype === template.subtype ? job.systems : null)
    return match ? mapSystemToComponent(match, template.key) : emptyComponent(template)
  })
}

export function remapComponentsForSystemType(current: ObservedComponentState[], systemType: string) {
  const templates = componentTemplate(systemType)
  return templates.map(template => {
    const existing = current.find(component => component.subtype === template.subtype || component.key === template.key)
    if (existing) return { ...existing, key: template.key, label: template.label, subtype: template.subtype }
    return emptyComponent(template)
  })
}

export function inferSharedTonnage(job: Job) {
  const candidates = (job.system_components ?? []).map(component => component.tonnage).filter((value): value is number => value != null)
  if (candidates.length > 0) return String(candidates[0])
  return job.systems?.tonnage != null ? String(job.systems.tonnage) : ''
}

export function inferSharedRefrigerant(job: Job) {
  const candidates = (job.system_components ?? []).map(component => component.refrigerant_type).filter((value): value is string => !!value)
  return candidates[0] ?? job.systems?.refrigerant_type ?? ''
}

export function parseRtuControls(controlsNotes: string | null | undefined) {
  if (!controlsNotes) return { controls: [] as string[], note: '' }
  const lines = controlsNotes.split('\n')
  const controlsLine = lines.find(line => line.startsWith('Controls:'))
  const notesLine = lines.find(line => line.startsWith('Notes:'))
  return {
    controls: controlsLine ? controlsLine.replace('Controls:', '').split(',').map(item => item.trim()).filter(Boolean) : [],
    note: notesLine ? notesLine.replace('Notes:', '').trim() : '',
  }
}

export function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatDelta(tempReturn: string, tempSupply: string, tstatMode: string) {
  const returnTemp = parseFloat(tempReturn)
  const supplyTemp = parseFloat(tempSupply)
  if (Number.isNaN(returnTemp) || Number.isNaN(supplyTemp)) return ''
  const raw = tstatMode === 'heat' || tstatMode === 'em_heat' ? supplyTemp - returnTemp : returnTemp - supplyTemp
  return String(Math.round(raw * 10) / 10)
}

export function isApartmentJob(job: Job) {
  const type = job.units?.unit_type?.trim().toLowerCase() ?? ''
  const name = job.units?.name?.trim().toLowerCase() ?? ''
  return !!job.units && type !== 'main' && name !== 'default'
}

export function withApartmentDefault(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

export function emptyCircuits(saved: Job['observation_circuits'] = []): ObservationCircuitState[] {
  const circuits = saved ?? []
  return ([1, 2] as const).map(circuitNumber => {
    const match = circuits.find(circuit => circuit.circuit_number === circuitNumber)
    return match
      ? {
          id: match.id,
          circuit_number: circuitNumber,
          suction_pressure: match.suction_pressure != null ? String(match.suction_pressure) : '',
          suction_line_temp: match.suction_line_temp != null ? String(match.suction_line_temp) : '',
          liquid_pressure: match.liquid_pressure != null ? String(match.liquid_pressure) : '',
          liquid_line_temp: match.liquid_line_temp != null ? String(match.liquid_line_temp) : '',
        }
      : {
          circuit_number: circuitNumber,
          suction_pressure: '',
          suction_line_temp: '',
          liquid_pressure: '',
          liquid_line_temp: '',
        }
  })
}

export function circuitHasValues(circuit: ObservationCircuitState) {
  return Boolean(
    circuit.suction_pressure
    || circuit.suction_line_temp
    || circuit.liquid_pressure
    || circuit.liquid_line_temp,
  )
}
