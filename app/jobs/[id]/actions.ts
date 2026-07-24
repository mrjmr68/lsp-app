'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { inferManufactureDate } from '@/utils/hvac/systems'
import { buildWorkflowSeedItems, JobWorkflowPhase, JobWorkflowType, QuickActionKey } from '@/utils/job-workflows'
import { JobCommercialState, JobResolutionType, JobStatus, getLegacyStatusFromLifecycle, getResolutionTypeForWorkflow } from '@/utils/job-lifecycle'
import { getNextRelayCycle, getNextRelayStepKeys, RELAY_STEP_BY_KEY } from './types'
import type { JobMessage, JobRelayActor, JobRelayKind, JobRelayStepKey } from './types'

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

type SharedWorkflowStatus = 'prep' | 'on_site' | 'closeout' | 'complete'
type CloseoutPath = 'invoice' | 'estimate'

async function getJobWorkspaceContext(jobId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null, role: null as string | null, job: null, error: 'Not authenticated' }
  }

  const [{ data: profile, error: profileError }, { data: job, error: jobError }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('jobs').select('id, assigned_tech, actual_tech').eq('id', jobId).maybeSingle(),
  ])

  if (profileError) return { supabase, user, role: null as string | null, job: null, error: profileError.message }
  if (jobError || !job) return { supabase, user, role: profile?.role ?? null, job: null, error: jobError?.message ?? 'Job not found.' }

  const role = profile?.role ?? null
  const privileged = role === 'owner' || role === 'admin' || role === 'dispatcher'
  const directAssignment = job.assigned_tech === user.id || job.actual_tech === user.id

  let helperAssignment = false
  if (!privileged && !directAssignment) {
    const { count, error: helperError } = await supabase
      .from('job_tech')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('user_id', user.id)

    if (helperError) {
      return { supabase, user, role, job, error: helperError.message }
    }
    helperAssignment = (count ?? 0) > 0
  }

  if (!privileged && !directAssignment && !helperAssignment) {
    return { supabase, user, role, job, error: 'Only assigned crew members can use this shared workspace.' }
  }

  return { supabase, user, role, job, error: null as string | null }
}

async function ensureJobWorkflow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  jobId: string,
  workflowType: JobWorkflowType,
) {
  const { data: existing, error: existingError } = await supabase
    .from('job_workflows')
    .select('id, status')
    .eq('job_id', jobId)
    .maybeSingle()

  if (existingError) return { workflowId: null, error: existingError.message }

  let workflowId = existing?.id ?? null

  if (!workflowId) {
    const { data: inserted, error: insertError } = await supabase
      .from('job_workflows')
      .insert({
        job_id: jobId,
        workflow_type: workflowType,
        status: 'prep',
        started_at: new Date().toISOString(),
        started_by: userId,
      })
      .select('id')
      .single()

    if (insertError || !inserted) return { workflowId: null, error: insertError?.message ?? 'Failed to create workflow.' }
    workflowId = inserted.id
  }

  const { count, error: itemCountError } = await supabase
    .from('job_workflow_items')
    .select('id', { count: 'exact', head: true })
    .eq('workflow_id', workflowId)

  if (itemCountError) return { workflowId, error: itemCountError.message }

  if ((count ?? 0) === 0) {
    const itemRows = buildWorkflowSeedItems(workflowType).map(item => ({
      workflow_id: workflowId,
      phase: item.phase,
      sort_order: item.sortOrder,
      label: item.label,
      details: item.details ?? null,
      action_key: item.actionKey ?? null,
      required: item.required ?? true,
    }))

    if (itemRows.length > 0) {
      const { error: itemInsertError } = await supabase
        .from('job_workflow_items')
        .insert(itemRows)

      if (itemInsertError) return { workflowId, error: itemInsertError.message }
    }
  }

  return { workflowId, error: null as string | null }
}

async function insertWorkflowMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  userId: string,
  message: {
    messageType: JobMessage['message_type']
    body: string
    quickActionKey?: string | null
    relayStepKey?: JobRelayStepKey | null
    relaySequence?: number | null
    relayActor?: JobRelayActor | null
    relayKind?: JobRelayKind | null
    relayCycle?: number | null
  },
) {
  const { error } = await supabase
    .from('job_messages')
    .insert({
      job_id: jobId,
      user_id: userId,
      message_type: message.messageType,
      body: message.body,
      quick_action_key: message.quickActionKey ?? null,
      relay_step_key: message.relayStepKey ?? null,
      relay_sequence: message.relaySequence ?? null,
      relay_actor: message.relayActor ?? null,
      relay_kind: message.relayKind ?? null,
      relay_cycle: message.relayCycle ?? null,
    })

  return error?.message ?? null
}

function revalidateJobWorkspace(jobId: string) {
  revalidatePath('/jobs')
  revalidatePath('/planning')
  revalidatePath(`/jobs/${jobId}`)
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
    .select('arrived_at, job_status, commercial_state, resolution_type')
    .eq('id', jobId)
    .single()

  if (!existing?.arrived_at) {
    const jobStatus: JobStatus = existing?.job_status === 'follow_up_scheduled' ? 'follow_up_active' : 'on_site'
    const { error } = await supabase
      .from('jobs')
      .update({
        job_status: jobStatus,
        status: getLegacyStatusFromLifecycle(jobStatus, existing?.commercial_state ?? 'none', existing?.resolution_type ?? null),
        arrived_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    if (error) return { error: error.message }

    await supabase.from('job_events').insert({
      job_id: jobId,
      user_id: user.id,
      event_type: 'arrived',
      gps_lat: lat,
      gps_lng: lng,
    })

    await supabase
      .from('job_workflows')
      .update({ status: 'on_site', updated_at: new Date().toISOString() })
      .eq('job_id', jobId)
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
  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
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

export async function startJobWorkflow(jobId: string, workflowType: JobWorkflowType) {
  const context = await getJobWorkspaceContext(jobId)
  if (context.error || !context.user) return { error: context.error ?? 'Not authenticated' }

  const { error: jobUpdateError } = await context.supabase
    .from('jobs')
    .update({
      workflow_type: workflowType,
      resolution_type: getResolutionTypeForWorkflow(workflowType),
    })
    .eq('id', jobId)

  if (jobUpdateError) return { error: jobUpdateError.message }

  const result = await ensureJobWorkflow(context.supabase, context.user.id, jobId, workflowType)
  if (result.error) return { error: result.error }

  const messageError = await insertWorkflowMessage(
    context.supabase,
    jobId,
    context.user.id,
    {
      messageType: 'system',
      body: workflowType === 'install' ? 'Shared install workflow started.' : 'Shared major repair workflow started.',
    },
  )

  if (messageError) return { error: messageError }

  revalidateJobWorkspace(jobId)
  return { success: true, workflowId: result.workflowId }
}

export async function updateJobWorkflowStatus(jobId: string, status: SharedWorkflowStatus) {
  const context = await getJobWorkspaceContext(jobId)
  if (context.error || !context.user) return { error: context.error ?? 'Not authenticated' }

  const { data: workflow, error: workflowError } = await context.supabase
    .from('job_workflows')
    .select('id')
    .eq('job_id', jobId)
    .maybeSingle()

  if (workflowError || !workflow) return { error: workflowError?.message ?? 'No workflow found.' }

  const payload: {
    status: SharedWorkflowStatus
    updated_at?: string
    completed_at?: string | null
  } = { status, updated_at: new Date().toISOString() }

  if (status === 'complete') payload.completed_at = new Date().toISOString()
  if (status !== 'complete') payload.completed_at ??= null

  const { error: updateError } = await context.supabase
    .from('job_workflows')
    .update(payload)
    .eq('id', workflow.id)

  if (updateError) return { error: updateError.message }

  const statusLabel: Record<SharedWorkflowStatus, string> = {
    prep: 'Workflow moved to prep.',
    on_site: 'Crew marked on site.',
    closeout: 'Workflow moved to closeout.',
    complete: 'Shared workflow marked complete.',
  }

  const messageError = await insertWorkflowMessage(
    context.supabase,
    jobId,
    context.user.id,
    {
      messageType: 'system',
      body: statusLabel[status],
    },
  )

  if (messageError) return { error: messageError }

  revalidateJobWorkspace(jobId)
  return { success: true }
}

export async function setJobChecklistItemStatus(itemId: string, completed: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: item, error: itemError } = await supabase
    .from('job_workflow_items')
    .select(`
      id, workflow_id,
      job_workflows!inner(job_id)
    `)
    .eq('id', itemId)
    .single()

  if (itemError || !item) return { error: itemError?.message ?? 'Checklist item not found.' }

  const workflow = Array.isArray(item.job_workflows) ? item.job_workflows[0] : item.job_workflows
  const jobId = workflow?.job_id ?? null
  if (!jobId) return { error: 'Checklist item is missing a job link.' }

  const context = await getJobWorkspaceContext(jobId)
  if (context.error) return { error: context.error }

  const payload = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    completed_by: completed ? user.id : null,
  }

  const { error: updateError } = await supabase
    .from('job_workflow_items')
    .update(payload)
    .eq('id', itemId)

  if (updateError) return { error: updateError.message }

  revalidateJobWorkspace(jobId)
  return { success: true }
}

export async function saveJobChecklistItemNote(itemId: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: item, error: itemError } = await supabase
    .from('job_workflow_items')
    .select(`
      id,
      job_workflows!inner(job_id)
    `)
    .eq('id', itemId)
    .single()

  if (itemError || !item) return { error: itemError?.message ?? 'Checklist item not found.' }
  const workflow = Array.isArray(item.job_workflows) ? item.job_workflows[0] : item.job_workflows
  const jobId = workflow?.job_id ?? null
  if (!jobId) return { error: 'Checklist item is missing a job link.' }

  const context = await getJobWorkspaceContext(jobId)
  if (context.error) return { error: context.error }

  const { error: updateError } = await supabase
    .from('job_workflow_items')
    .update({ note: cleanNullableText(note) })
    .eq('id', itemId)

  if (updateError) return { error: updateError.message }

  revalidateJobWorkspace(jobId)
  return { success: true }
}

export async function addJobChecklistItem(jobId: string, phase: JobWorkflowPhase, label: string) {
  const context = await getJobWorkspaceContext(jobId)
  if (context.error || !context.user) return { error: context.error ?? 'Not authenticated' }

  const { data: existingWorkflow, error: workflowError } = await context.supabase
    .from('job_workflows')
    .select('id, workflow_type')
    .eq('job_id', jobId)
    .maybeSingle()

  if (workflowError || !existingWorkflow) return { error: workflowError?.message ?? 'No workflow found.' }

  const ensured = await ensureJobWorkflow(context.supabase, context.user.id, jobId, existingWorkflow.workflow_type as JobWorkflowType)
  if (ensured.error || !ensured.workflowId) return { error: ensured.error ?? 'No workflow found.' }

  const trimmedLabel = label.trim()
  if (!trimmedLabel) return { error: 'Checklist item label is required.' }

  const { data: existingItems, error: existingItemsError } = await context.supabase
    .from('job_workflow_items')
    .select('sort_order')
    .eq('workflow_id', ensured.workflowId)
    .eq('phase', phase)
    .order('sort_order', { ascending: false })
    .limit(1)

  if (existingItemsError) return { error: existingItemsError.message }

  const nextSortOrder = (existingItems?.[0]?.sort_order ?? 0) + 1

  const { error: insertError } = await context.supabase
    .from('job_workflow_items')
    .insert({
      workflow_id: ensured.workflowId,
      phase,
      label: trimmedLabel,
      sort_order: nextSortOrder,
      required: false,
    })

  if (insertError) return { error: insertError.message }

  revalidateJobWorkspace(jobId)
  return { success: true }
}

export async function addJobMessage(jobId: string, body: string) {
  const context = await getJobWorkspaceContext(jobId)
  if (context.error || !context.user) return { error: context.error ?? 'Not authenticated' }

  const trimmedBody = body.trim()
  if (!trimmedBody) return { error: 'Message cannot be empty.' }

  const messageError = await insertWorkflowMessage(
    context.supabase,
    jobId,
    context.user.id,
    {
      messageType: 'text',
      body: trimmedBody,
    },
  )

  if (messageError) return { error: messageError }

  revalidateJobWorkspace(jobId)
  return { success: true }
}

export async function addJobQuickAction(jobId: string, quickActionKey: string, label: string) {
  const context = await getJobWorkspaceContext(jobId)
  if (context.error || !context.user) return { error: context.error ?? 'Not authenticated' }

  const trimmedLabel = label.trim()
  if (!trimmedLabel) return { error: 'Quick action label is required.' }

  const messageError = await insertWorkflowMessage(
    context.supabase,
    jobId,
    context.user.id,
    {
      messageType: 'quick_action',
      body: trimmedLabel,
      quickActionKey,
    },
  )

  if (messageError) return { error: messageError }

  const { data: workflow, error: workflowError } = await context.supabase
    .from('job_workflows')
    .select('id')
    .eq('job_id', jobId)
    .maybeSingle()

  if (workflowError) return { error: workflowError.message }

  if (workflow?.id) {
    await context.supabase
      .from('job_workflow_items')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        completed_by: context.user.id,
      })
      .eq('workflow_id', workflow.id)
      .eq('action_key', quickActionKey as QuickActionKey)
      .eq('completed', false)
  }

  revalidateJobWorkspace(jobId)
  return { success: true }
}

export async function addJobRelayEvent(jobId: string, relayStepKey: JobRelayStepKey) {
  const context = await getJobWorkspaceContext(jobId)
  if (context.error || !context.user) return { error: context.error ?? 'Not authenticated' }

  const relayStep = RELAY_STEP_BY_KEY[relayStepKey]
  if (!relayStep) return { error: 'Relay action is not recognized.' }

  const { data: latestRelay, error: latestRelayError } = await context.supabase
    .from('job_messages')
    .select('relay_step_key, relay_cycle, created_at')
    .eq('job_id', jobId)
    .eq('message_type', 'relay')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestRelayError) return { error: latestRelayError.message }

  const expectedStepKeys = getNextRelayStepKeys((latestRelay?.relay_step_key as JobRelayStepKey | null | undefined) ?? null)
  if (!expectedStepKeys.includes(relayStepKey)) {
    return { error: 'That relay tap is out of order for the current execution state.' }
  }

  const relayCycle = getNextRelayCycle(
    (latestRelay?.relay_step_key as JobRelayStepKey | null | undefined) ?? null,
    latestRelay?.relay_cycle ?? null,
  )

  const messageError = await insertWorkflowMessage(
    context.supabase,
    jobId,
    context.user.id,
    {
      messageType: 'relay',
      body: relayStep.label,
      relayStepKey: relayStep.key,
      relaySequence: relayStep.sequence,
      relayActor: relayStep.actor,
      relayKind: relayStep.kind,
      relayCycle,
    },
  )

  if (messageError) return { error: messageError }

  revalidateJobWorkspace(jobId)
  return { success: true }
}

export async function closeJob(
  jobId: string,
  lat: number | null,
  lng: number | null,
  completionPath: CloseoutPath = 'invoice',
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, diagnosis_id, workflow_type')
    .eq('id', jobId)
    .single()

  if (jobError || !job) return { error: jobError?.message ?? 'Job not found.' }

  const { data: workflow, error: workflowError } = await supabase
    .from('job_workflows')
    .select('id')
    .eq('job_id', jobId)
    .maybeSingle()

  if (workflowError) return { error: workflowError.message }

  if (workflow?.id) {
    const { count: incompleteRequiredCount, error: workflowItemsError } = await supabase
      .from('job_workflow_items')
      .select('id', { count: 'exact', head: true })
      .eq('workflow_id', workflow.id)
      .eq('required', true)
      .eq('completed', false)

    if (workflowItemsError) return { error: workflowItemsError.message }
    if ((incompleteRequiredCount ?? 0) > 0) {
      return { error: 'Complete the required shared workflow checklist items before closing the job.' }
    }
  }

  const { count: adhocBundleCount, error: adhocBundleError } = await supabase
    .from('job_adhoc_bundles')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)

  if (adhocBundleError) return { error: adhocBundleError.message }

  const hasDiagnosis = !!job.diagnosis_id
  const hasAdhocBundle = (adhocBundleCount ?? 0) > 0
  let resolutionType: JobResolutionType | null = getResolutionTypeForWorkflow(job.workflow_type)

  if (!workflow?.id && !hasDiagnosis && !hasAdhocBundle) {
    return { error: 'Complete the job with a diagnosis or save an ad-hoc repair before closing it out.' }
  }

  if (completionPath === 'estimate' && workflow?.id) {
    return { error: 'Shared workflow jobs still close to invoice review for now.' }
  }

  if (completionPath === 'estimate' && !hasDiagnosis) {
    return { error: 'Choose a diagnosis before routing this job to estimate review.' }
  }

  if (!resolutionType) {
    if (hasAdhocBundle) {
      resolutionType = 'adhoc_repair'
    } else if (hasDiagnosis) {
      resolutionType = 'standard_repair'
    } else {
      resolutionType = 'closed_no_action'
    }
  }

  let jobStatus: JobStatus = 'completed'
  let commercialState: JobCommercialState =
    resolutionType === 'closed_no_action' ? 'none' : 'ready_for_invoice'
  let newDiagnosisRequested = workflow?.id ? true : (!hasDiagnosis && hasAdhocBundle)

  if (completionPath === 'estimate') {
    resolutionType = 'repair_estimate'
    jobStatus = 'follow_up_planning'
    commercialState = 'estimate_needed'
    newDiagnosisRequested = false
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      job_status:         jobStatus,
      resolution_type:    resolutionType,
      commercial_state:   commercialState,
      status:             getLegacyStatusFromLifecycle(jobStatus, commercialState, resolutionType),
      completed_at:       new Date().toISOString(),
      needs_admin_review: true,
      new_diagnosis_requested: newDiagnosisRequested,
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

  if (workflow?.id) {
    await supabase
      .from('job_workflows')
      .update({
        status: 'complete',
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', workflow.id)
  }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath('/planning')
  revalidatePath('/estimates')
  revalidatePath(`/estimates/${jobId}`)
  return { success: true }
}
