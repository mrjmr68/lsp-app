import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import JobFlow from './JobFlow'

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, status, priority, manual_unit, problem_description,
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
        .select('id, job_date, status, manual_unit, diagnoses!jobs_diagnosis_id_fkey(repair_code)')
        .eq('system_id', job.system_id)
        .neq('id', id)
        .in('status', ['completed', 'invoiced'])
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

  const [
    { data: serviceHistory, error: serviceHistoryError },
    { data: diagnoses, error: diagnosesError },
    { data: repairBundles, error: repairBundlesError },
    { data: catalogItems, error: catalogItemsError },
    { data: existingAddOns, error: existingAddOnsError },
    { data: systemComponents, error: systemComponentsError },
    { data: observationCircuits, error: observationCircuitsError },
    { data: adhocBundle, error: adhocBundleError },
  ] = await Promise.all([
    serviceHistoryPromise,
    diagnosesPromise,
    repairBundlesPromise,
    catalogItemsPromise,
    existingAddOnsPromise,
    systemComponentsPromise,
    observationCircuitsPromise,
    adhocBundlePromise,
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

  return (
    <AppShell>
      <JobFlow
        job={{
          ...(job as any),
          systems: primarySystem as any,
          system_components: (systemComponents ?? []) as any,
          observation_circuits: (observationCircuits ?? []) as any,
          adhoc_bundle: (adhocBundle ?? null) as any,
        }}
        serviceHistory={(serviceHistory ?? []) as any}
        diagnoses={(diagnoses ?? []) as any}
        repairBundles={(repairBundles ?? []) as any}
        catalogItems={(catalogItems ?? []) as any}
        existingAddOns={(existingAddOns ?? []) as any}
      />
    </AppShell>
  )
}
