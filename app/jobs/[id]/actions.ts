'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { inferManufactureDate } from '@/utils/hvac/systems'

function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function parseNullableNumber(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const parsed = parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function mapSubtypeFromType(systemType: string | null | undefined) {
  switch (systemType) {
    case 'rtu':
      return 'RTU'
    case 'ptac':
      return 'PTAC'
    case 'air_handler':
      return 'AHU'
    case 'condensing_unit':
      return 'CU'
    case 'heat_pump':
      return 'AHU'
    default:
      return null
  }
}

function defaultObservedSystemName(systemType: string | null | undefined) {
  switch (systemType) {
    case 'rtu':
      return 'RTU'
    case 'heat_pump':
      return 'Heat Pump'
    case 'ptac':
      return 'PTAC'
    case 'air_handler':
      return 'Air Handler'
    case 'condensing_unit':
      return 'Condensing Unit'
    default:
      return 'System'
  }
}

type ObservedSystemComponentInput = {
  id?: string | null
  key: string
  label: string
  subtype: string
  make?: string | null
  model?: string | null
  serial_number?: string | null
  tonnage?: string | null
  refrigerant_type?: string | null
  metering_device?: string | null
  heating_capacity_btu?: string | null
}

type ObservedSystemSnapshot = {
  systemName: string
  systemType: string
  servedAreas: string
  thermostatLocation: string
  equipmentLocation: string
  systemNotes: string
  rtuControls: string[]
  rtuControlsNote: string
  components: ObservedSystemComponentInput[]
}

type ObservedCircuitInput = {
  id?: string | null
  circuit_number: 1 | 2
  suction_pressure: number | null
  suction_line_temp: number | null
  liquid_pressure: number | null
  liquid_line_temp: number | null
}

type JobAdhocLineInput = {
  item_id: string
  quantity: number
}

export async function markArrived(
  jobId: string,
  lat: number | null,
  lng: number | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Idempotent — only record arrival once
  const { data: existing } = await supabase
    .from('jobs')
    .select('arrived_at')
    .eq('id', jobId)
    .single()

  if (!existing?.arrived_at) {
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'in_progress', arrived_at: new Date().toISOString() })
      .eq('id', jobId)
    if (error) return { error: error.message }

    await supabase.from('job_events').insert({
      job_id: jobId,
      user_id: user.id,
      event_type: 'arrived',
      gps_lat: lat,
      gps_lng: lng,
    })
  }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  return { success: true, arrivedAt: existing?.arrived_at ?? new Date().toISOString() }
}

export async function saveObservations(
  jobId: string,
  data: {
    tstat_mode: string
    tstat_fan: string
    temp_outdoor: number | null
    temp_outdoor_auto: number | null
    temp_return: number | null
    temp_supply: number | null
    arrival_notes: string
    circuits: ObservedCircuitInput[]
  },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('jobs')
    .update({
      tstat_mode: data.tstat_mode || null,
      tstat_fan: data.tstat_fan || null,
      temp_outdoor: data.temp_outdoor,
      temp_outdoor_auto: data.temp_outdoor_auto,
      temp_return: data.temp_return,
      temp_supply: data.temp_supply,
      arrival_notes: data.arrival_notes || null,
    })
    .eq('id', jobId)

  if (error) return { error: error.message }

  const desiredCircuits = data.circuits
    .filter(circuit => circuit.circuit_number === 1 || circuit.circuit_number === 2)
    .map(circuit => ({
      job_id: jobId,
      circuit_number: circuit.circuit_number,
      suction_pressure: circuit.suction_pressure,
      suction_line_temp: circuit.suction_line_temp,
      liquid_pressure: circuit.liquid_pressure,
      liquid_line_temp: circuit.liquid_line_temp,
    }))

  const activeCircuitNumbers = desiredCircuits.map(circuit => circuit.circuit_number)
  const obsoleteCircuitNumbers = ([1, 2] as const).filter(circuitNumber => !activeCircuitNumbers.includes(circuitNumber))

  if (obsoleteCircuitNumbers.length > 0) {
    const { error: deleteError } = await supabase
      .from('job_observation_circuits')
      .delete()
      .eq('job_id', jobId)
      .in('circuit_number', obsoleteCircuitNumbers)

    if (deleteError) return { error: deleteError.message }
  }

  if (desiredCircuits.length > 0) {
    const { error: upsertError } = await supabase
      .from('job_observation_circuits')
      .upsert(desiredCircuits, { onConflict: 'job_id,circuit_number' })

    if (upsertError) return { error: upsertError.message }
  }

  const { data: circuits, error: circuitsError } = await supabase
    .from('job_observation_circuits')
    .select('id, circuit_number, suction_pressure, suction_line_temp, liquid_pressure, liquid_line_temp')
    .eq('job_id', jobId)
    .order('circuit_number')

  if (circuitsError) return { error: circuitsError.message }

  revalidatePath(`/jobs/${jobId}`)
  return { success: true, circuits: circuits ?? [] }
}

export async function setDiagnosis(jobId: string, diagnosisId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('jobs')
    .update({
      diagnosis_id: diagnosisId,
      new_diagnosis_requested: false,
    })
    .eq('id', jobId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function saveJobAdhocBundle(
  jobId: string,
  data: {
    tech_description: string
    lines: JobAdhocLineInput[]
  },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const techDescription = data.tech_description.trim()
  if (!techDescription) return { error: 'An ad-hoc repair description is required.' }

  const normalizedLines = data.lines
    .filter(line => line.item_id && Number.isFinite(line.quantity) && line.quantity > 0)
    .map(line => ({
      item_id: line.item_id,
      quantity: Math.round(line.quantity * 100) / 100,
      added_by: user.id,
    }))

  const itemIds = normalizedLines.map(line => line.item_id)
  const { data: items, error: itemsError } = itemIds.length > 0
    ? await supabase
        .from('items')
        .select('id, unit_cost')
        .in('id', itemIds)
    : { data: [], error: null }

  if (itemsError) return { error: itemsError.message }

  const costByItemId = new Map((items ?? []).map(item => [item.id, item.unit_cost ?? 0]))

  const { data: existingBundle, error: existingBundleError } = await supabase
    .from('job_adhoc_bundles')
    .select('id')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingBundleError) return { error: existingBundleError.message }

  let adhocBundleId = existingBundle?.id ?? null

  if (adhocBundleId) {
    const { error: updateError } = await supabase
      .from('job_adhoc_bundles')
      .update({
        tech_description: techDescription,
        reviewed_by_admin: false,
        admin_action: null,
        promoted_diagnosis_id: null,
      })
      .eq('id', adhocBundleId)

    if (updateError) return { error: updateError.message }

    const { error: deleteLinesError } = await supabase
      .from('job_adhoc_bundle_lines')
      .delete()
      .eq('adhoc_bundle_id', adhocBundleId)

    if (deleteLinesError) return { error: deleteLinesError.message }
  } else {
    const { data: insertedBundle, error: insertBundleError } = await supabase
      .from('job_adhoc_bundles')
      .insert({
        job_id: jobId,
        tech_description: techDescription,
      })
      .select('id')
      .single()

    if (insertBundleError || !insertedBundle) {
      return { error: insertBundleError?.message ?? 'Failed to create ad-hoc bundle.' }
    }

    adhocBundleId = insertedBundle.id
  }

  if (!adhocBundleId) return { error: 'No ad-hoc bundle could be saved.' }

  if (normalizedLines.length > 0) {
    const { error: insertLinesError } = await supabase
      .from('job_adhoc_bundle_lines')
      .insert(normalizedLines.map(line => ({
        adhoc_bundle_id: adhocBundleId,
        ...line,
        cost_at_build: costByItemId.get(line.item_id) ?? 0,
      })))

    if (insertLinesError) return { error: insertLinesError.message }
  }

  const { error: updateJobError } = await supabase
    .from('jobs')
    .update({
      diagnosis_id: null,
      new_diagnosis_requested: true,
    })
    .eq('id', jobId)

  if (updateJobError) return { error: updateJobError.message }

  revalidatePath(`/jobs/${jobId}`)
  revalidatePath('/jobs')
  return { success: true, adhocBundleId }
}

export async function clearJobAdhocBundle(jobId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: bundles, error: bundlesError } = await supabase
    .from('job_adhoc_bundles')
    .select('id')
    .eq('job_id', jobId)

  if (bundlesError) return { error: bundlesError.message }

  const bundleIds = (bundles ?? []).map(bundle => bundle.id)

  if (bundleIds.length > 0) {
    const { error: deleteLinesError } = await supabase
      .from('job_adhoc_bundle_lines')
      .delete()
      .in('adhoc_bundle_id', bundleIds)

    if (deleteLinesError) return { error: deleteLinesError.message }

    const { error: deleteBundlesError } = await supabase
      .from('job_adhoc_bundles')
      .delete()
      .in('id', bundleIds)

    if (deleteBundlesError) return { error: deleteBundlesError.message }
  }

  const { error: updateJobError } = await supabase
    .from('jobs')
    .update({ new_diagnosis_requested: false })
    .eq('id', jobId)

  if (updateJobError) return { error: updateJobError.message }

  revalidatePath(`/jobs/${jobId}`)
  revalidatePath('/jobs')
  return { success: true }
}

export async function addJobAddOn(
  jobId: string,
  type: 'bundle' | 'item',
  bundleId: string | null,
  itemId: string | null,
  quantity: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('job_addons')
    .insert({
      job_id:    jobId,
      type,
      bundle_id: bundleId,
      item_id:   itemId,
      quantity,
      added_by:  user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { success: true, id: data.id }
}

export async function removeJobAddOn(addOnId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('job_addons')
    .delete()
    .eq('id', addOnId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateSystem(
  jobId: string,
  systemId: string,
  fields: {
    name?: string | null
    system_type?: string | null
    system_subtype?: string | null
    make?: string | null
    model?: string | null
    serial_number?: string | null
    tonnage?: number | null
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

  let currentMake: string | null = null
  let currentSerial: string | null = null
  if ('make' in fields || 'serial_number' in fields) {
    const { data: currentSystem } = await supabase
      .from('systems')
      .select('make, serial_number')
      .eq('id', systemId)
      .single()

    currentMake = currentSystem?.make ?? null
    currentSerial = currentSystem?.serial_number ?? null
  }

  const nextFields: Record<string, unknown> = { ...fields }
  if ('make' in fields || 'serial_number' in fields) {
    const { manufactureDate, source } = inferManufactureDate(
      fields.make ?? currentMake,
      fields.serial_number ?? currentSerial,
    )
    nextFields.manufacture_date = manufactureDate
    nextFields.manufacture_date_source = source
  }

  const { data, error } = await supabase
    .from('systems')
    .update(nextFields)
    .select('id, name, system_type, system_subtype, make, model, serial_number, tonnage, refrigerant_type, metering_device, served_areas, thermostat_location, equipment_location, controls_notes, notes, manufacture_date, manufacture_date_source')
    .eq('id', systemId)
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/jobs/${jobId}`)
  return { success: true, system: data }
}

export async function createObservedSystem(
  jobId: string,
  fields: {
    name?: string | null
    system_type?: string | null
    system_subtype?: string | null
    make?: string | null
    model?: string | null
    serial_number?: string | null
    tonnage?: string | null
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

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, customer_id, location_id, unit_id, system_id')
    .eq('id', jobId)
    .single()

  if (jobError || !job) return { error: jobError?.message ?? 'Job not found' }
  if (job.system_id) return { error: 'This job already has a linked system.' }
  if (!job.location_id) return { error: 'Job is missing a location and cannot create a system.' }

  let unitId = job.unit_id
  if (!unitId) {
    const { data: existingUnit } = await supabase
      .from('units')
      .select('id')
      .eq('location_id', job.location_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existingUnit?.id) {
      unitId = existingUnit.id
    } else {
      const { data: newUnit, error: unitError } = await supabase
        .from('units')
        .insert({
          location_id: job.location_id,
          name: 'Default',
          unit_type: 'main',
        })
        .select('id')
        .single()

      if (unitError || !newUnit) {
        return { error: unitError?.message ?? 'Failed to create a default unit for this location.' }
      }
      unitId = newUnit.id
    }
  }

  const make = cleanNullableText(fields.make)
  const serialNumber = cleanNullableText(fields.serial_number)
  const { manufactureDate, source } = inferManufactureDate(make, serialNumber)

  const payload = {
    unit_id: unitId,
    name: cleanNullableText(fields.name) ?? defaultObservedSystemName(fields.system_type),
    system_type: cleanNullableText(fields.system_type),
    system_subtype: cleanNullableText(fields.system_subtype) ?? mapSubtypeFromType(fields.system_type),
    make,
    model: cleanNullableText(fields.model),
    serial_number: serialNumber,
    tonnage: parseNullableNumber(fields.tonnage),
    refrigerant_type: cleanNullableText(fields.refrigerant_type),
    metering_device: cleanNullableText(fields.metering_device),
    served_areas: cleanNullableText(fields.served_areas),
    thermostat_location: cleanNullableText(fields.thermostat_location),
    equipment_location: cleanNullableText(fields.equipment_location),
    controls_notes: cleanNullableText(fields.controls_notes),
    notes: cleanNullableText(fields.notes),
    manufacture_date: manufactureDate,
    manufacture_date_source: source,
  }

  const { data: system, error: systemError } = await supabase
    .from('systems')
    .insert(payload)
    .select('id, name, system_type, system_subtype, make, model, serial_number, tonnage, refrigerant_type, metering_device, served_areas, thermostat_location, equipment_location, controls_notes, notes, manufacture_date, manufacture_date_source')
    .single()

  if (systemError || !system) {
    return { error: systemError?.message ?? 'Failed to create system.' }
  }

  const { error: linkError } = await supabase
    .from('jobs')
    .update({ system_id: system.id, unit_id: unitId })
    .eq('id', jobId)

  if (linkError) return { error: linkError.message }

  revalidatePath(`/jobs/${jobId}`)
  revalidatePath('/jobs')
  return { success: true, system }
}

function normalizeObservedComponent(component: ObservedSystemComponentInput) {
  const make = cleanNullableText(component.make)
  const serialNumber = cleanNullableText(component.serial_number)
  const { manufactureDate, source } = inferManufactureDate(make, serialNumber)

  return {
    id: component.id ?? null,
    key: component.key,
    label: component.label,
    subtype: component.subtype,
    make,
    model: cleanNullableText(component.model),
    serial_number: serialNumber,
    tonnage: parseNullableNumber(component.tonnage),
    refrigerant_type: cleanNullableText(component.refrigerant_type),
    metering_device: cleanNullableText(component.metering_device),
    heating_capacity_btu: parseNullableNumber(component.heating_capacity_btu),
    manufacture_date: manufactureDate,
    manufacture_date_source: source,
  }
}

function buildControlsNotes(controls: string[], note: string) {
  const parts: string[] = []
  if (controls.length > 0) {
    parts.push(`Controls: ${controls.join(', ')}`)
  }
  const trimmedNote = note.trim()
  if (trimmedNote) {
    parts.push(`Notes: ${trimmedNote}`)
  }
  return parts.join('\n') || null
}

export async function saveObservedSystemSnapshot(
  jobId: string,
  snapshot: ObservedSystemSnapshot,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, location_id, unit_id, system_id,
      systems!jobs_system_id_fkey(id, group_name, system_type)
    `)
    .eq('id', jobId)
    .single()

  if (jobError || !job) return { error: jobError?.message ?? 'Job not found' }
  if (!job.location_id) return { error: 'Job is missing a location and cannot save system data.' }

  const primarySystem = Array.isArray(job.systems) ? job.systems[0] ?? null : job.systems

  let unitId = job.unit_id
  if (!unitId) {
    const { data: existingUnit } = await supabase
      .from('units')
      .select('id')
      .eq('location_id', job.location_id)
      .limit(1)
      .maybeSingle()

    if (existingUnit?.id) {
      unitId = existingUnit.id
    } else {
      const { data: newUnit, error: unitError } = await supabase
        .from('units')
        .insert({ location_id: job.location_id, name: 'Default', unit_type: 'main' })
        .select('id')
        .single()

      if (unitError || !newUnit) return { error: unitError?.message ?? 'Failed to create a default unit for this location.' }
      unitId = newUnit.id
    }
  }

  const normalizedSystemType = cleanNullableText(snapshot.systemType)
  if (!normalizedSystemType) return { error: 'System type is required.' }

  const groupName = cleanNullableText(snapshot.systemName) ?? defaultObservedSystemName(normalizedSystemType)
  const servedAreas = cleanNullableText(snapshot.servedAreas)
  const thermostatLocation = cleanNullableText(snapshot.thermostatLocation)
  const equipmentLocation = cleanNullableText(snapshot.equipmentLocation)
  const notes = cleanNullableText(snapshot.systemNotes)
  const controlsNotes = normalizedSystemType === 'rtu'
    ? buildControlsNotes(snapshot.rtuControls, snapshot.rtuControlsNote)
    : null

  const desiredComponents = snapshot.components.map(normalizeObservedComponent)
  if (desiredComponents.length === 0) return { error: 'At least one equipment component is required.' }

  const existingGroupName = primarySystem?.group_name ?? null
  const { data: existingSystems } = existingGroupName
    ? await supabase
        .from('systems')
        .select('id, system_subtype')
        .eq('unit_id', unitId)
        .eq('group_name', existingGroupName)
    : { data: job.system_id ? [{ id: job.system_id, system_subtype: primarySystem?.system_type ?? null }] : [] }

  const existingBySubtype = new Map<string, { id: string; system_subtype: string | null }>()
  for (const existing of existingSystems ?? []) {
    if (existing.system_subtype) existingBySubtype.set(existing.system_subtype, existing)
  }

  const upsertedIds: string[] = []

  for (const component of desiredComponents) {
    const payload = {
      unit_id: unitId,
      name: component.label,
      system_type: normalizedSystemType,
      system_subtype: component.subtype,
      group_name: groupName,
      make: component.make,
      model: component.model,
      serial_number: component.serial_number,
      tonnage: component.tonnage,
      refrigerant_type: component.refrigerant_type,
      metering_device: component.metering_device,
      heating_capacity_btu: component.heating_capacity_btu,
      served_areas: servedAreas,
      thermostat_location: thermostatLocation,
      equipment_location: equipmentLocation,
      controls_notes: controlsNotes,
      notes,
      manufacture_date: component.manufacture_date,
      manufacture_date_source: component.manufacture_date_source,
    }

    const existingMatch =
      (component.id ? { id: component.id, system_subtype: component.subtype } : null) ??
      existingBySubtype.get(component.subtype) ??
      null

    if (existingMatch) {
      const { error } = await supabase
        .from('systems')
        .update(payload)
        .eq('id', existingMatch.id)
      if (error) return { error: error.message }
      upsertedIds.push(existingMatch.id)
    } else {
      const { data: inserted, error } = await supabase
        .from('systems')
        .insert(payload)
        .select('id')
        .single()
      if (error || !inserted) return { error: error?.message ?? 'Failed to create system component.' }
      upsertedIds.push(inserted.id)
    }
  }

  const obsoleteIds = (existingSystems ?? [])
    .map(system => system.id)
    .filter(id => !upsertedIds.includes(id))

  if (obsoleteIds.length > 0) {
    const { error } = await supabase
      .from('systems')
      .delete()
      .in('id', obsoleteIds)
    if (error) return { error: error.message }
  }

  const primarySystemId = upsertedIds[0] ?? null
  if (!primarySystemId) return { error: 'No primary system could be saved.' }

  const { error: jobUpdateError } = await supabase
    .from('jobs')
    .update({ system_id: primarySystemId, unit_id: unitId })
    .eq('id', jobId)

  if (jobUpdateError) return { error: jobUpdateError.message }

  const { data: systems, error: refreshedSystemsError } = await supabase
    .from('systems')
    .select(`
      id, name, system_type, system_subtype, group_name, tonnage,
      make, model, serial_number, refrigerant_type, metering_device,
      heating_capacity_btu,
      notes, served_areas, thermostat_location, equipment_location,
      controls_notes, manufacture_date, manufacture_date_source
    `)
    .eq('unit_id', unitId)
    .eq('group_name', groupName)
    .order('system_subtype')

  if (refreshedSystemsError) return { error: refreshedSystemsError.message }

  revalidatePath(`/jobs/${jobId}`)
  revalidatePath('/jobs')
  return { success: true, systems: systems ?? [], primarySystemId, groupName }
}

export async function closeJob(
  jobId: string,
  lat: number | null,
  lng: number | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, diagnosis_id')
    .eq('id', jobId)
    .single()

  if (jobError || !job) return { error: jobError?.message ?? 'Job not found.' }

  const { count: adhocBundleCount, error: adhocBundleError } = await supabase
    .from('job_adhoc_bundles')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)

  if (adhocBundleError) return { error: adhocBundleError.message }

  const hasDiagnosis = !!job.diagnosis_id
  const hasAdhocBundle = (adhocBundleCount ?? 0) > 0

  if (!hasDiagnosis && !hasAdhocBundle) {
    return { error: 'Complete the job with a diagnosis or save an ad-hoc repair before closing it out.' }
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      status:             'completed',
      completed_at:       new Date().toISOString(),
      needs_admin_review: true,
      new_diagnosis_requested: !hasDiagnosis && hasAdhocBundle,
      actual_tech:        user.id,
    })
    .eq('id', jobId)

  if (error) return { error: error.message }

  await supabase.from('job_events').insert({
    job_id:     jobId,
    user_id:    user.id,
    event_type: 'completed',
    gps_lat:    lat,
    gps_lng:    lng,
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath('/planning')
  return { success: true }
}
