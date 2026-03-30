import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import JobFlow from './JobFlow'
import { CatalogItem, DiagnosisItem, HistoryJob, Job, JobAddOn, JobCrewMember, JobMessage, JobWorkflow, RepairBundle } from './types'

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state,
      priority, workflow_type, manual_unit, problem_description,
      access_confirmation_needed, access_confirmed,
      assigned_tech, actual_tech, job_date, arrived_at, completed_at,
      tstat_mode, tstat_fan,
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

  if (jobError) {
    console.error('Job detail query error:', jobError.message, jobError.details, jobError.hint)
  }
  if (!job) return notFound()

  const primarySystem = Array.isArray(job.systems) ? job.systems[0] ?? null : job.systems

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

  const serviceHistoryPromise = job.system_id
    ? supabase
      .from('jobs')
        .select('id, job_date, status, job_status, resolution_type, commercial_state, manual_unit, diagnoses!jobs_diagnosis_id_fkey(repair_code)')
        .eq('system_id', job.system_id)
        .neq('id', id)
        .eq('job_status', 'completed')
        .order('job_date', { ascending: false })
        .limit(10)
    : Promise.resolve({ data: [], error: null })

  const diagnosesPromise = supabase
    .from('diagnoses')
    .select('id, repair_code, location, component, action, cat1, cat2, cat3, invoice_description, repair_notes, one_shot, variable_pricing')
    .eq('active', true)
    .order('repair_code')

  const repairBundlesPromise = supabase
    .from('repair_bundles')
    .select(`
      id, diagnosis_id, name, addon_eligible, addon_description, notes,
      repair_bundle_lines(id, quantity, items(id, name, type, unit, is_placeholder))
    `)

  const catalogItemsPromise = supabase
    .from('items')
    .select('id, name, type, unit, is_placeholder, unit_cost')
    .eq('active', true)
    .eq('alacarte_eligible', true)

  const existingAddOnsPromise = supabase
    .from('job_addons')
    .select('id, type, quantity, repair_bundles(id, name), items(id, name, unit)')
    .eq('job_id', id)

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

  const workflowPromise = supabase
    .from('job_workflows')
    .select(`
      id, workflow_type, status, started_at, completed_at,
      job_workflow_items(
        id, phase, sort_order, label, details, action_key,
        required, completed, completed_at, completed_by, note
      )
    `)
    .eq('job_id', id)
    .maybeSingle()

  const jobMessagesPromise = supabase
    .from('job_messages')
    .select(`
      id, message_type, body, quick_action_key, created_at, user_id,
      users!job_messages_user_id_fkey(first_name, last_name)
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: true })

  const crewAssignmentsPromise = supabase
    .from('job_tech')
    .select('user_id, role')
    .eq('job_id', id)

  const [
    { data: serviceHistory, error: serviceHistoryError },
    { data: diagnoses, error: diagnosesError },
    { data: repairBundles, error: repairBundlesError },
    { data: catalogItems, error: catalogItemsError },
    { data: existingAddOns, error: existingAddOnsError },
    { data: systemComponents, error: systemComponentsError },
    { data: observationCircuits, error: observationCircuitsError },
    { data: adhocBundle, error: adhocBundleError },
    { data: workflow, error: workflowError },
    { data: jobMessages, error: jobMessagesError },
    { data: crewAssignments, error: crewAssignmentsError },
  ] = await Promise.all([
    serviceHistoryPromise,
    diagnosesPromise,
    repairBundlesPromise,
    catalogItemsPromise,
    existingAddOnsPromise,
    systemComponentsPromise,
    observationCircuitsPromise,
    adhocBundlePromise,
    workflowPromise,
    jobMessagesPromise,
    crewAssignmentsPromise,
  ])

  if (serviceHistoryError) {
    console.error('Service history query error:', serviceHistoryError.message, serviceHistoryError.details, serviceHistoryError.hint)
  }
  if (diagnosesError) {
    console.error('Diagnoses query error:', diagnosesError.message, diagnosesError.details, diagnosesError.hint)
  }
  if (repairBundlesError) {
    console.error('Repair bundles query error:', repairBundlesError.message, repairBundlesError.details, repairBundlesError.hint)
  }
  if (catalogItemsError) {
    console.error('Catalog items query error:', catalogItemsError.message, catalogItemsError.details, catalogItemsError.hint)
  }
  if (existingAddOnsError) {
    console.error('Job add-ons query error:', existingAddOnsError.message, existingAddOnsError.details, existingAddOnsError.hint)
  }
  if (systemComponentsError) {
    console.error('System components query error:', systemComponentsError.message, systemComponentsError.details, systemComponentsError.hint)
  }
  if (observationCircuitsError) {
    console.error('Observation circuits query error:', observationCircuitsError.message, observationCircuitsError.details, observationCircuitsError.hint)
  }
  if (adhocBundleError) {
    console.error('Ad-hoc bundle query error:', adhocBundleError.message, adhocBundleError.details, adhocBundleError.hint)
  }
  if (workflowError) {
    console.error('Job workflow query error:', workflowError.message, workflowError.details, workflowError.hint)
  }
  if (jobMessagesError) {
    console.error('Job messages query error:', jobMessagesError.message, jobMessagesError.details, jobMessagesError.hint)
  }
  if (crewAssignmentsError) {
    console.error('Job crew query error:', crewAssignmentsError.message, crewAssignmentsError.details, crewAssignmentsError.hint)
  }

  const crewUserIds = Array.from(new Set([
    job.assigned_tech,
    job.actual_tech,
    ...((crewAssignments ?? []).map(assignment => assignment.user_id)),
  ].filter((value): value is string => !!value)))

  const { data: crewUsers, error: crewUsersError } = crewUserIds.length > 0
    ? await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .in('id', crewUserIds)
    : { data: [], error: null }

  if (crewUsersError) {
    console.error('Job crew user query error:', crewUsersError.message, crewUsersError.details, crewUsersError.hint)
  }

  const crewById = new Map((crewUsers ?? []).map(member => [member.id, member]))
  const crewMembers = [
    job.assigned_tech ? { id: job.assigned_tech, assignment_role: 'assigned' as const } : null,
    job.actual_tech ? { id: job.actual_tech, assignment_role: 'actual' as const } : null,
    ...((crewAssignments ?? []).map(assignment => ({
      id: assignment.user_id,
      assignment_role: assignment.role as 'primary' | 'assist',
    }))),
  ]
    .filter((member): member is { id: string; assignment_role: 'assigned' | 'actual' | 'primary' | 'assist' } => !!member)
    .map(member => {
      const details = crewById.get(member.id)
      return details
        ? {
            id: details.id,
            first_name: details.first_name,
            last_name: details.last_name,
            role: details.role,
            assignment_role: member.assignment_role,
          }
        : null
    })
    .filter((member, index, list): member is NonNullable<typeof member> => !!member && list.findIndex(other => other?.id === member.id) === index)
  const viewerRole = (profile?.role ?? null) as 'tech' | 'dispatcher' | 'admin' | 'owner' | null
  const jobData = {
    ...job,
    systems: primarySystem,
    system_components: systemComponents ?? [],
    observation_circuits: observationCircuits ?? [],
    adhoc_bundle: adhocBundle ?? null,
  } as Job

  return (
    <AppShell>
      <JobFlow
        viewerRole={viewerRole}
        currentUserId={user.id}
        job={jobData}
        serviceHistory={(serviceHistory ?? []) as HistoryJob[]}
        diagnoses={(diagnoses ?? []) as DiagnosisItem[]}
        repairBundles={(repairBundles ?? []) as RepairBundle[]}
        catalogItems={(catalogItems ?? []) as CatalogItem[]}
        existingAddOns={(existingAddOns ?? []) as JobAddOn[]}
        workflow={(workflow ?? null) as JobWorkflow | null}
        jobMessages={(jobMessages ?? []) as JobMessage[]}
        crewMembers={crewMembers as JobCrewMember[]}
      />
    </AppShell>
  )
}
