'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { inferManufactureDate } from '@/utils/hvac/systems'

type SharedSystemFields = {
  system_type: string | null
  group_name: string | null
  served_areas: string | null
  thermostat_location: string | null
  equipment_location: string | null
  controls_notes: string | null
  notes: string | null
}

type ComponentFields = {
  make: string | null
  model: string | null
  serial_number: string | null
  tonnage: number | null
  refrigerant_type: string | null
  metering_device: string | null
  manufacture_date: string | null
  manufacture_date_source: string | null
}

function cleanText(value: FormDataEntryValue | null) {
  const text = value?.toString().trim()
  return text ? text : null
}

function parseNumber(value: FormDataEntryValue | null) {
  const text = value?.toString().trim()
  if (!text) return null
  const parsed = parseFloat(text)
  return Number.isFinite(parsed) ? parsed : null
}

function readSharedSystemFields(formData: FormData, prefix = ''): SharedSystemFields {
  return {
    system_type: cleanText(formData.get(`${prefix}system_type`)),
    group_name: cleanText(formData.get(`${prefix}group_name`)),
    served_areas: cleanText(formData.get(`${prefix}served_areas`)),
    thermostat_location: cleanText(formData.get(`${prefix}thermostat_location`)),
    equipment_location: cleanText(formData.get(`${prefix}equipment_location`)),
    controls_notes: cleanText(formData.get(`${prefix}controls_notes`)),
    notes: cleanText(formData.get(`${prefix}notes`)),
  }
}

function readComponentFields(formData: FormData, prefix = ''): ComponentFields {
  const make = cleanText(formData.get(`${prefix}make`))
  const serialNumber = cleanText(formData.get(`${prefix}serial_number`))
  const { manufactureDate, source } = inferManufactureDate(make, serialNumber)

  return {
    make,
    model: cleanText(formData.get(`${prefix}model`)),
    serial_number: serialNumber,
    tonnage: parseNumber(formData.get(`${prefix}tonnage`)),
    refrigerant_type: cleanText(formData.get(`${prefix}refrigerant_type`)),
    metering_device: cleanText(formData.get(`${prefix}metering_device`)),
    manufacture_date: manufactureDate,
    manufacture_date_source: source,
  }
}

function mapSingleSubtype(systemType: string | null) {
  switch (systemType) {
    case 'rtu':
      return 'RTU'
    case 'ptac':
      return 'PTAC'
    case 'air_handler':
      return 'AHU'
    case 'condensing_unit':
      return 'CU'
    default:
      return null
  }
}

function defaultSystemName(systemType: string | null, subtype: string | null, unitName?: string | null) {
  if (systemType === 'heat_pump') return 'Heat Pump'
  if (systemType === 'ptac') return unitName ? `${unitName} PTAC` : 'PTAC'
  if (systemType === 'rtu') return 'RTU'
  if (systemType === 'air_handler') return unitName ? `${unitName} AHU` : 'AHU'
  if (systemType === 'condensing_unit') return unitName ? `${unitName} CU` : 'CU'
  return subtype ?? 'System'
}

function buildSingleSystemInsert({
  unitId,
  name,
  shared,
  component,
}: {
  unitId: string
  name: string
  shared: SharedSystemFields
  component: ComponentFields
}) {
  return {
    unit_id: unitId,
    name,
    system_type: shared.system_type,
    system_subtype: mapSingleSubtype(shared.system_type),
    group_name: shared.group_name,
    served_areas: shared.served_areas,
    thermostat_location: shared.thermostat_location,
    equipment_location: shared.equipment_location,
    controls_notes: shared.controls_notes,
    notes: shared.notes,
    ...component,
  }
}

function buildHeatPumpSystemInserts({
  unitId,
  shared,
  outdoor,
  indoor,
}: {
  unitId: string
  shared: SharedSystemFields
  outdoor: ComponentFields
  indoor: ComponentFields
}) {
  const label = shared.group_name ?? 'Heat Pump'

  return [
    {
      unit_id: unitId,
      name: `${label} - CU`,
      system_type: 'heat_pump',
      system_subtype: 'CU',
      group_name: label,
      served_areas: shared.served_areas,
      thermostat_location: shared.thermostat_location,
      equipment_location: shared.equipment_location,
      controls_notes: shared.controls_notes,
      notes: shared.notes,
      ...outdoor,
    },
    {
      unit_id: unitId,
      name: `${label} - AHU`,
      system_type: 'heat_pump',
      system_subtype: 'AHU',
      group_name: label,
      served_areas: shared.served_areas,
      thermostat_location: shared.thermostat_location,
      equipment_location: shared.equipment_location,
      controls_notes: shared.controls_notes,
      notes: shared.notes,
      ...indoor,
    },
  ]
}

function buildSystemInsertPayloads(formData: FormData, unitId: string, prefix = '', unitName?: string | null) {
  const shared = readSharedSystemFields(formData, prefix)
  if (!shared.system_type) return []

  if (shared.system_type === 'heat_pump') {
    const outdoor = readComponentFields(formData, `${prefix}outdoor_`)
    const indoor = readComponentFields(formData, `${prefix}indoor_`)
    return buildHeatPumpSystemInserts({ unitId, shared, outdoor, indoor })
  }

  const explicitName = cleanText(formData.get(`${prefix}name`))
  const subtype = mapSingleSubtype(shared.system_type)
  const name = explicitName ?? defaultSystemName(shared.system_type, subtype, unitName)
  const component = readComponentFields(formData, prefix)

  return [buildSingleSystemInsert({ unitId, name, shared, component })]
}

async function insertSystemsFromForm(supabase: Awaited<ReturnType<typeof createClient>>, formData: FormData, unitId: string, prefix = '', unitName?: string | null) {
  const inserts = buildSystemInsertPayloads(formData, unitId, prefix, unitName)
  if (inserts.length === 0) return { success: true }

  const { error } = await supabase
    .from('systems')
    .insert(inserts)

  if (error) return { error: error.message }
  return { success: true }
}

function coerceNullableText(value: unknown) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function enrichSystemUpdate(fields: Record<string, unknown>, currentMake?: string | null, currentSerial?: string | null) {
  const nextFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, coerceNullableText(value)])
  )

  const nextMake =
    typeof nextFields.make === 'string' || nextFields.make === null
      ? (nextFields.make as string | null)
      : undefined
  const nextSerial =
    typeof nextFields.serial_number === 'string' || nextFields.serial_number === null
      ? (nextFields.serial_number as string | null)
      : undefined

  if (nextMake !== undefined || nextSerial !== undefined) {
    const { manufactureDate, source } = inferManufactureDate(
      nextMake ?? currentMake ?? null,
      nextSerial ?? currentSerial ?? null,
    )
    nextFields.manufacture_date = manufactureDate
    nextFields.manufacture_date_source = source
  }

  return nextFields
}

// Customer

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  const type = (formData.get('type') as string) || null
  const parentId = (formData.get('parent_id') as string) || null
  const billingAddress = (formData.get('billing_address') as string)?.trim() || null
  const billingEmail = (formData.get('billing_email') as string)?.trim() || null
  const billingPhone = (formData.get('billing_phone') as string)?.trim() || null
  const billToParent = formData.get('bill_to_parent') === 'true'
  const notes = (formData.get('notes') as string)?.trim() || null

  if (billingEmail && !billingEmail.includes('@')) {
    return { error: 'Invalid email address' }
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      name,
      type,
      parent_id: parentId,
      billing_address: billingAddress,
      billing_email: billingEmail,
      billing_phone: billingPhone,
      bill_to_parent: billToParent,
      notes,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/customers')
  return { success: true, id: data.id }
}

export async function updateCustomer(
  customerId: string,
  fields: {
    name?: string
    type?: string | null
    parent_id?: string | null
    billing_address?: string | null
    billing_email?: string | null
    billing_phone?: string | null
    bill_to_parent?: boolean
    notes?: string | null
  },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('customers')
    .update(fields)
    .eq('id', customerId)

  if (error) return { error: error.message }
  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true }
}

// Location

export async function createLocation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const customerId = formData.get('customer_id') as string
  if (!customerId) return { error: 'Customer is required' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  const streetAddress = (formData.get('street_address') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null
  const state = (formData.get('state') as string)?.trim() || null
  const zip = (formData.get('zip') as string)?.trim() || null
  const accessNotes = (formData.get('access_notes') as string)?.trim() || null
  const taxRateStr = formData.get('tax_rate') as string
  const taxRate = taxRateStr ? parseFloat(taxRateStr) : null

  if (taxRate !== null && (taxRate < 0 || taxRate > 0.15)) {
    return { error: 'Tax rate must be between 0 and 0.15 (0-15%)' }
  }

  const { data, error } = await supabase
    .from('locations')
    .insert({
      customer_id: customerId,
      name,
      street_address: streetAddress,
      city,
      state,
      zip,
      access_notes: accessNotes,
      tax_rate: taxRate,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/customers/${customerId}`)
  return { success: true, id: data.id }
}

export async function updateLocation(
  locationId: string,
  customerId: string,
  fields: {
    name?: string
    street_address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    access_notes?: string | null
    tax_rate?: number | null
  },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('locations')
    .update(fields)
    .eq('id', locationId)

  if (error) return { error: error.message }
  revalidatePath(`/customers/${customerId}`)
  revalidatePath(`/customers/${customerId}/${locationId}`)
  return { success: true }
}

// Unit

export async function createUnit(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const locationId = formData.get('location_id') as string
  const customerId = formData.get('customer_id') as string
  if (!locationId) return { error: 'Location is required' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  const unitType = (formData.get('unit_type') as string) || null
  const notes = (formData.get('notes') as string)?.trim() || null

  const { data, error } = await supabase
    .from('units')
    .insert({
      location_id: locationId,
      name,
      unit_type: unitType,
      notes,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/customers/${customerId}/${locationId}`)
  return { success: true, id: data.id }
}

export async function updateUnit(
  unitId: string,
  customerId: string,
  locationId: string,
  fields: {
    name?: string
    unit_type?: string | null
    notes?: string | null
  },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('units')
    .update(fields)
    .eq('id', unitId)

  if (error) return { error: error.message }
  revalidatePath(`/customers/${customerId}/${locationId}`)
  revalidatePath(`/customers/${customerId}/${locationId}/${unitId}`)
  return { success: true }
}

// System

export async function createSystem(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const unitId = formData.get('unit_id') as string
  const customerId = formData.get('customer_id') as string
  const locationId = formData.get('location_id') as string
  if (!unitId) return { error: 'Unit is required' }

  const { data: unit } = await supabase
    .from('units')
    .select('name')
    .eq('id', unitId)
    .single()

  const result = await insertSystemsFromForm(supabase, formData, unitId, '', unit?.name ?? null)
  if (result.error) return result

  revalidatePath(`/customers/${customerId}/${locationId}/${unitId}`)
  return { success: true }
}

export async function updateSystemFromCustomers(
  systemId: string,
  customerId: string,
  locationId: string,
  unitId: string,
  fields: {
    name?: string
    system_type?: string | null
    system_subtype?: string | null
    group_name?: string | null
    tonnage?: number | null
    make?: string | null
    model?: string | null
    serial_number?: string | null
    refrigerant_type?: string | null
    metering_device?: string | null
    served_areas?: string | null
    thermostat_location?: string | null
    equipment_location?: string | null
    controls_notes?: string | null
    notes?: string | null
  },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: currentSystem } = await supabase
    .from('systems')
    .select('make, serial_number')
    .eq('id', systemId)
    .single()

  const { error } = await supabase
    .from('systems')
    .update(enrichSystemUpdate(fields, currentSystem?.make ?? null, currentSystem?.serial_number ?? null))
    .eq('id', systemId)

  if (error) return { error: error.message }
  revalidatePath(`/customers/${customerId}/${locationId}/${unitId}`)
  revalidatePath(`/customers/${customerId}/${locationId}`)
  return { success: true }
}

// System for Location (commercial flat hierarchy)

export async function createSystemForLocation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const locationId = formData.get('location_id') as string
  const customerId = formData.get('customer_id') as string
  if (!locationId) return { error: 'Location is required' }

  const { data: existingUnits } = await supabase
    .from('units')
    .select('id')
    .eq('location_id', locationId)
    .limit(1)

  let unitId: string
  if (existingUnits && existingUnits.length > 0) {
    unitId = existingUnits[0].id
  } else {
    const { data: newUnit, error: unitErr } = await supabase
      .from('units')
      .insert({ location_id: locationId, name: 'Default', unit_type: 'main' })
      .select('id')
      .single()
    if (unitErr || !newUnit) return { error: unitErr?.message ?? 'Failed to create unit' }
    unitId = newUnit.id
  }

  const result = await insertSystemsFromForm(supabase, formData, unitId)
  if (result.error) return result

  revalidatePath(`/customers/${customerId}/${locationId}`)
  return { success: true }
}

// Unit with System (apartment combined creation)

export async function createUnitWithSystem(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const locationId = formData.get('location_id') as string
  const customerId = formData.get('customer_id') as string
  if (!locationId) return { error: 'Location is required' }

  const unitName = (formData.get('unit_name') as string)?.trim()
  if (!unitName) return { error: 'Unit name is required' }

  const unitType = (formData.get('unit_type') as string) || null
  const unitNotes = (formData.get('unit_notes') as string)?.trim() || null

  const { data: newUnit, error: unitErr } = await supabase
    .from('units')
    .insert({ location_id: locationId, name: unitName, unit_type: unitType, notes: unitNotes })
    .select('id')
    .single()

  if (unitErr || !newUnit) return { error: unitErr?.message ?? 'Failed to create unit' }

  const result = await insertSystemsFromForm(supabase, formData, newUnit.id, 'sys_', unitName)
  if (result.error) return result

  revalidatePath(`/customers/${customerId}/${locationId}`)
  return { success: true, id: newUnit.id }
}
