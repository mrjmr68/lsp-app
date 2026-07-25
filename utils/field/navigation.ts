export interface AddressParts {
  street_address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  name?: string | null
}

export function formatAddress(parts: AddressParts): string {
  const line1 = parts.street_address?.trim()
  const line2 = [parts.city, parts.state].filter(Boolean).join(', ')
  const zip = parts.zip?.trim()
  const cityStateZip = [line2, zip].filter(Boolean).join(' ')
  return [line1, cityStateZip].filter(Boolean).join(', ')
}

export function buildMapsUrl(parts: AddressParts): string | null {
  const query = formatAddress(parts) || parts.name?.trim()
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function buildSmsUrl(phone: string, message: string): string {
  const normalized = phone.replace(/[^\d+]/g, '')
  return `sms:${normalized}?body=${encodeURIComponent(message)}`
}

export function buildTelUrl(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '')
  return `tel:${normalized}`
}
