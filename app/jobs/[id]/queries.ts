import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import { firstRelation } from '@/utils/supabase/relations'
import type {
  CatalogItem,
  DiagnosisItem,
  HistoryJob,
  Job,
  JobAddOn,
  JobCrewMember,
  JobMessage,
  JobWorkflow,
  RepairBundle,
} from './types'

// ─── Minimal job data for the layout header ───────────────────────────

export const getJobSummary = cache(async (id: string) => {
  const supabase = await createClient()

  const { data: job } = await supabase
    .from('jobs')
    .select(`
      id, job_status, resolution_type, commercial_state,
      arrived_at, tstat_mode, tstat_fan, diagnosis_id,
      customers!jobs_customer_id_fkey(name),
      locations!jobs_location_id_fkey(name),
      units!jobs_unit_id_fkey(name),
      systems!jobs_system_id_fkey(make, system_type, system_subtype)
    `)
    .eq('id', id)
    .single()

  if (!job) return null

  const hasAdhocBundle = await supabase
    .from('job_adhoc_bundles')
    .select('id')
    .eq('job_id', id)
    .limit(1)
    .maybeSingle()

  const hasWorkflow = await supabase
    .from('job_workflows')
    .select('id')
    .eq('job_id', id)
    .limit(1)
    .maybeSingle()

  return {
    id: job.id,
    job_status: job.job_status,
    resolution_type: job.resolution_type,
    commercial_state: job.commercial_state,
    arrived_at: job.arrived_at,
    tstat_mode: job.tstat_mode,
    tstat_fan: job.tstat_fan,
    diagnosis_id: job.diagnosis_id,
    has_adhoc_bundle: !!hasAdhocBundle.data,
    has_workflow: !!hasWorkflow.data,
    customer_name: firstRelation(job.customers)?.name ?? null,
    location_name: firstRelation(job.locations)?.name ?? null,
    unit_name: firstRelation(job.units)?.name ?? null,
    system_make: firstRelation(job.systems)?.make ?? null,
    system_type: firstRelation(job.systems)?.system_type ?? null,
  }
})

// ─── Full job data for step pages ────────────────────────────────────

export const getJobFull = cache(async (id: string) => {
  const supabase = await createClient()

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state,
      priority, workflow_type, manual_unit, problem_description,
      access_confirmation_needed, access_confirmed,
      assigned_tech, actual_tech, job_date, arrived_at, completed_at,
      tstat_mode, tstat_fan, system_response,
      temp_outdoor, temp_outdoor_auto, temp_return, temp_supply,
      arrival_notes, diagnosis_id, needs_admin_review, new_diagnosis_requested,
      customer_id, location_id, unit_id, system_id,
      customers!jobs_customer_id_fkey(id, name),
      locations!jobs_location_id_fkey(id, name, access_notes),
      units!jobs_unit_id_fkey(id, name, unit_type),
      systems!jobs_system_id_fkey(
        id, name, system_type, system_subtype, group_name, tonnage,
        make, model, serial_number, refrigerant_type, metering_device,
        heating_capacity_btu,
        notes, served_areas, thermostat_location, equipment_location,
        controls_notes, manufacture_date, manufacture_date_source
      ),
      diagnoses!jobs_diagnosis_id_fkey(id, repair_code, repair_notes)
    `)
    .eq('id', id)
    .single()

  if (jobError) console.error('Job query error:', jobError.message)
  if (!job) return null

  const primarySystem = firstRelation(job.systems)

  const systemComponentsPromise =
    job.unit_id && primarySystem?.group_name
      ? supabase
          .from('systems')
          .select(`
            id, name, system_type, system_subtype, group_name, tonnage,
            make, model, serial_number, refrigerant_type, metering_device,
            heating_capacity_btu,
            notes, served_areas, thermostat_location, equipment_location,
            controls_notes, manufacture_date, manufacture_date_source
          `)
          .eq('unit_id', job.unit_id)
          .eq('group_name', primarySystem.group_name)
          .order('system_subtype')
      : job.system_id
          ? Promise.resolve({ data: [primarySystem].filter(Boolean), error: null })
          : Promise.resolve({ data: [], error: null })

  const observationCircuitsPromise = supabase
    .from('job_observation_circuits')
    .select('id, circuit_number, suction_pressure, suction_line_temp, liquid_pressure, liquid_line_temp')
    .eq('job_id', id)
    .order('circuit_number')

  const adhocBundlePromise = supabase
    .from('job_adhoc_bundles')
    .select(`
      id, tech_description, reviewed_by_admin, admin_action, promoted_diagnosis_id,
      job_adhoc_bundle_lines(
        id, quantity,
        items(id, name, type, unit, is_placeholder)
      )
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [
    { data: systemComponents },
    { data: observationCircuits },
    { data: adhocBundle },
  ] = await Promise.all([
    systemComponentsPromise,
    observationCircuitsPromise,
    adhocBundlePromise,
  ])

  return {
    ...job,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
    units: firstRelation(job.units),
    systems: primarySystem,
    diagnoses: firstRelation(job.diagnoses),
    system_components: systemComponents ?? [],
    observation_circuits: observationCircuits ?? [],
    adhoc_bundle: adhocBundle ?? null,
  } as Job
})

// ─── Service history ─────────────────────────────────────────────────

export const getServiceHistory = cache(async (jobId: string, systemId: string | null) => {
  if (!systemId) return [] as HistoryJob[]
  const supabase = await createClient()

  const { data } = await supabase
    .from('jobs')
    .select('id, job_date, status, job_status, resolution_type, commercial_state, manual_unit, diagnoses!jobs_diagnosis_id_fkey(repair_code)')
    .eq('system_id', systemId)
    .neq('id', jobId)
    .eq('job_status', 'completed')
    .order('job_date', { ascending: false })
    .limit(10)

  return (data ?? []).map(h => ({
    ...h,
    diagnoses: firstRelation(h.diagnoses),
  })) as HistoryJob[]
})

// ─── Workflow + crew + messages ──────────────────────────────────────

export const getWorkflow = cache(async (jobId: string) => {
  const supabase = await createClient()

  const { data } = await supabase
    .from('job_workflows')
    .select(`
      id, workflow_type, status, started_at, completed_at,
      job_workflow_items(
        id, phase, sort_order, label, details, action_key,
        required, completed, completed_at, completed_by, note
      )
    `)
    .eq('job_id', jobId)
    .maybeSingle()

  return (data ?? null) as JobWorkflow | null
})

export const getCrewMembers = cache(async (jobId: string, assignedTech: string | null, actualTech: string | null) => {
  const supabase = await createClient()

  const { data: crewAssignments } = await supabase
    .from('job_tech')
    .select('user_id, role')
    .eq('job_id', jobId)

  const crewUserIds = Array.from(new Set([
    assignedTech,
    actualTech,
    ...((crewAssignments ?? []).map(a => a.user_id)),
  ].filter((v): v is string => !!v)))

  if (crewUserIds.length === 0) return [] as JobCrewMember[]

  const { data: crewUsers } = await supabase
    .from('users')
    .select('id, first_name, last_name, role')
    .in('id', crewUserIds)

  const crewById = new Map((crewUsers ?? []).map(m => [m.id, m]))
  return [
    assignedTech ? { id: assignedTech, assignment_role: 'assigned' as const } : null,
    actualTech ? { id: actualTech, assignment_role: 'actual' as const } : null,
    ...((crewAssignments ?? []).map(a => ({
      id: a.user_id,
      assignment_role: a.role as 'primary' | 'assist',
    }))),
  ]
    .filter((m): m is { id: string; assignment_role: 'assigned' | 'actual' | 'primary' | 'assist' } => !!m)
    .map(m => {
      const d = crewById.get(m.id)
      return d ? { id: d.id, first_name: d.first_name, last_name: d.last_name, role: d.role, assignment_role: m.assignment_role } : null
    })
    .filter((m, i, list): m is NonNullable<typeof m> => !!m && list.findIndex(o => o?.id === m.id) === i) as JobCrewMember[]
})

export const getJobMessages = cache(async (jobId: string) => {
  const supabase = await createClient()

  const { data } = await supabase
    .from('job_messages')
    .select(`
      id, message_type, body, quick_action_key, created_at, user_id,
      relay_step_key, relay_sequence, relay_actor, relay_kind, relay_cycle,
      users!job_messages_user_id_fkey(first_name, last_name)
    `)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  return (data ?? []).map(m => ({
    ...m,
    users: firstRelation(m.users) ?? { first_name: '', last_name: '' },
  })) as JobMessage[]
})

// ─── Catalog data for diagnose/work steps ───────────────────────────

export const getDiagnoses = cache(async () => {
  const supabase = await createClient()

  const { data } = await supabase
    .from('diagnoses')
    .select('id, repair_code, location, component, action, cat1, cat2, cat3, invoice_description, repair_notes, one_shot, variable_pricing')
    .eq('active', true)
    .order('repair_code')

  return (data ?? []) as DiagnosisItem[]
})

export const getRepairBundles = cache(async () => {
  const supabase = await createClient()

  const { data } = await supabase
    .from('repair_bundles')
    .select(`
      id, diagnosis_id, name, addon_eligible, addon_description, notes,
      repair_bundle_lines(id, quantity, items(id, name, type, unit, is_placeholder))
    `)

  return (data ?? []).map(bundle => ({
    ...bundle,
    repair_bundle_lines: (bundle.repair_bundle_lines ?? []).map(line => ({
      ...line,
      items: firstRelation(line.items),
    })),
  })) as RepairBundle[]
})

export const getCatalogItems = cache(async () => {
  const supabase = await createClient()

  const { data } = await supabase
    .from('items')
    .select('id, name, type, unit, is_placeholder, unit_cost')
    .eq('active', true)
    .eq('alacarte_eligible', true)

  return (data ?? []) as CatalogItem[]
})

export const getExistingAddOns = cache(async (jobId: string) => {
  const supabase = await createClient()

  const { data } = await supabase
    .from('job_addons')
    .select('id, type, quantity, repair_bundles(id, name), items(id, name, unit)')
    .eq('job_id', jobId)

  return (data ?? []).map(addOn => ({
    ...addOn,
    repair_bundles: firstRelation(addOn.repair_bundles),
    items: firstRelation(addOn.items),
  })) as JobAddOn[]
})

// ─── Auth helper ─────────────────────────────────────────────────────

export const getViewerRole = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, role: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    role: (profile?.role ?? null) as 'tech' | 'dispatcher' | 'admin' | 'owner' | null,
  }
})
