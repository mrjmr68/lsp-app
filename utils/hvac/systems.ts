export const MAKE_OPTIONS = [
  'Carrier',
  'Bryant',
  'Payne',
  'ICP',
  'Heil',
  'Tempstar',
  'Comfortmaker',
  'Arcoaire',
  'Day & Night',
  'Goodman',
  'Amana',
  'Daikin',
  'Lennox',
  'Trane',
  'American Standard',
  'Rheem',
  'Ruud',
  'York',
  'Coleman',
  'Luxaire',
  'Frigidaire',
  'Nortek',
  'Mitsubishi',
  'Fujitsu',
  'LG',
  'Samsung',
  'Gree',
  'Bosch',
  'Other',
] as const

export const SYSTEM_TYPE_OPTIONS = [
  { value: 'rtu', label: 'RTU' },
  { value: 'heat_pump', label: 'Heat Pump' },
  { value: 'ptac', label: 'PTAC' },
  { value: 'air_handler', label: 'Air Handler' },
  { value: 'condensing_unit', label: 'Condensing Unit' },
] as const

export const SYSTEM_SUBTYPE_OPTIONS = [
  { value: 'RTU', label: 'RTU' },
  { value: 'AHU', label: 'AHU' },
  { value: 'CU', label: 'CU' },
  { value: 'MS-Head', label: 'MS-Head' },
  { value: 'MS-Cond', label: 'MS-Cond' },
  { value: 'PTAC', label: 'PTAC' },
] as const

export const REFRIGERANT_OPTIONS = [
  { value: 'R-410A', label: 'R-410A' },
  { value: 'R-22', label: 'R-22' },
  { value: 'R-32', label: 'R-32' },
  { value: 'other', label: 'Other' },
] as const

export const METERING_OPTIONS = [
  { value: 'TXV', label: 'TXV' },
  { value: 'fixed_orifice', label: 'Fixed Orifice' },
  { value: 'other', label: 'Other' },
] as const

export type LogicalSystemType = 'rtu' | 'heat_pump' | 'ptac' | 'air_handler' | 'condensing_unit'

export function normalizeMake(make: string | null | undefined) {
  return make?.trim().toLowerCase() ?? ''
}

function toIsoMonthDate(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
}

function resolveTwoDigitYear(twoDigitYear: number) {
  if (twoDigitYear < 0 || twoDigitYear > 99) return null
  return twoDigitYear >= 80 ? 1900 + twoDigitYear : 2000 + twoDigitYear
}

function inferCarrierStyleDate(serial: string) {
  const cleaned = serial.replace(/[^a-z0-9]/gi, '').toUpperCase()
  const match = cleaned.match(/^(\d{2})(\d{2})/)
  if (!match) return null

  const week = parseInt(match[1], 10)
  const year = resolveTwoDigitYear(parseInt(match[2], 10))
  if (!year || week < 1 || week > 53) return null

  const approxMonth = Math.min(12, Math.max(1, Math.ceil(week / 4.5)))
  return toIsoMonthDate(year, approxMonth)
}

function inferGoodmanStyleDate(serial: string) {
  const cleaned = serial.replace(/[^a-z0-9]/gi, '').toUpperCase()
  const match = cleaned.match(/^(\d{2})(\d{2})/)
  if (!match) return null

  const year = 2000 + parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  return toIsoMonthDate(year, month)
}

function inferLennoxStyleDate(serial: string) {
  const cleaned = serial.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (cleaned.length < 6) return null

  const year = resolveTwoDigitYear(parseInt(cleaned.slice(2, 4), 10))
  const month = parseInt(cleaned.slice(4, 6), 10)
  if (!year) return null
  return toIsoMonthDate(year, month)
}

function inferTraneStyleDate(serial: string) {
  const cleaned = serial.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (cleaned.length < 3) return null

  const yearDigit = parseInt(cleaned[0], 10)
  const monthCode = cleaned[1]
  if (Number.isNaN(yearDigit)) return null

  const monthMap: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6,
    G: 7, H: 8, J: 9, K: 10, L: 11, M: 12,
  }
  const month = monthMap[monthCode]
  if (!month) return null

  const currentYear = new Date().getFullYear()
  const decadeBase = Math.floor(currentYear / 10) * 10
  let year = decadeBase + yearDigit
  if (year > currentYear + 1) year -= 10

  return toIsoMonthDate(year, month)
}

export function inferManufactureDate(make: string | null | undefined, serialNumber: string | null | undefined) {
  const serial = serialNumber?.trim()
  if (!make || !serial) {
    return { manufactureDate: null, source: null }
  }

  const normalized = normalizeMake(make)

  let manufactureDate: string | null = null
  if ([
    'carrier', 'bryant', 'payne', 'icp', 'heil', 'tempstar',
    'comfortmaker', 'arcoaire', 'day & night',
  ].includes(normalized)) {
    manufactureDate = inferCarrierStyleDate(serial)
  } else if (['goodman', 'amana', 'daikin'].includes(normalized)) {
    manufactureDate = inferGoodmanStyleDate(serial)
  } else if (normalized === 'lennox') {
    manufactureDate = inferLennoxStyleDate(serial)
  } else if (['trane', 'american standard'].includes(normalized)) {
    manufactureDate = inferTraneStyleDate(serial)
  }

  return {
    manufactureDate,
    source: manufactureDate ? 'derived_from_make_and_serial' : null,
  }
}

export function formatStoredDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
