import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import PlanningBoard, { Customer, Job, Location, PlanningCrewMember, Tech } from './PlanningBoard'
import { addJob } from './actions'
import { DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES_FILTER } from '@/utils/job-lifecycle'
import { firstRelation } from '@/utils/supabase/relations'

type JobCrewRow = {
  job_id: string
  user_id: string
  role: 'primary' | 'assist'
}

export default async function PlanningPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  // Today's jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select(`
      id,
      status,
      job_status,
      resolution_type,
      commercial_state,
      priority,
      manual_unit,
      problem_description,
      queue_position,
      access_confirmation_needed,
      access_confirmed,
      assigned_tech,
      job_date,
      location_id,
      customer_id,
      diagnosis_id,
      locations!jobs_location_id_fkey ( name ),
      customers!jobs_customer_id_fkey ( name ),
      diagnoses!jobs_diagnosis_id_fkey ( repair_code )
    `)
    .eq('job_date', today)
    .neq('job_status', 'cancelled')
    .not('commercial_state', 'in', DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES_FILTER)
    .order('queue_position', { ascending: true, nullsFirst: false })

  if (jobsError) {
    console.error('Jobs query error:', jobsError.message, jobsError.details, jobsError.hint)
  }

  const { data: insertedProfiles, error: profileSyncError } = await supabase
    .rpc('backfill_missing_user_profiles')

  if (profileSyncError) {
    console.error('User profile backfill error:', profileSyncError.message, profileSyncError.details, profileSyncError.hint)
  } else if ((insertedProfiles ?? 0) > 0) {
    console.log(`Backfilled ${insertedProfiles} missing user profile(s) for planning.`)
  }

  const { data: techs, error: techsError } = await supabase
    .rpc('list_assignable_users')

  if (techsError) {
    console.error('Assignable users query error:', techsError.message, techsError.details, techsError.hint)
  }

  let techsDiagnostic: string | null = null
  if (techsError) {
    techsDiagnostic = 'Assignable users could not be loaded. Check the user-profile sync migration and Supabase function permissions.'
  } else if ((techs ?? []).length === 0) {
    techsDiagnostic = 'No active assignable users were found. Confirm public.users has active rows with roles tech, dispatcher, admin, or owner.'
  }

  const jobIds = (jobs ?? []).map(job => job.id)
  const { data: jobCrewRows, error: jobCrewError } = jobIds.length > 0
    ? await supabase
        .from('job_tech')
        .select('job_id, user_id, role')
        .in('job_id', jobIds)
    : { data: [], error: null }

  if (jobCrewError) {
    console.error('Planning crew query error:', jobCrewError.message, jobCrewError.details, jobCrewError.hint)
  }

  const assignableTechs = (techs ?? []) as Tech[]
  const techById = new Map(assignableTechs.map(tech => [tech.id, tech]))
  const crewByJobId = new Map<string, PlanningCrewMember[]>()

  for (const row of ((jobCrewRows ?? []) as JobCrewRow[])) {
    const tech = techById.get(row.user_id)
    if (!tech) continue

    const currentCrew = crewByJobId.get(row.job_id) ?? []
    currentCrew.push({
      id: tech.id,
      first_name: tech.first_name,
      last_name: tech.last_name,
      role: tech.role,
      assignment_role: row.role,
    })
    crewByJobId.set(row.job_id, currentCrew)
  }

  const planningJobs = (jobs ?? []).map(job => ({
    ...job,
    locations: firstRelation(job.locations),
    customers: firstRelation(job.customers),
    diagnoses: firstRelation(job.diagnoses),
    crew_members: crewByJobId.get(job.id) ?? [],
  })) as Job[]

  // Customers — exclude parent-only accounts from job creation
  // (bill_to_parent children are fine; pure parents with no location work are excluded)
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, type')
    .order('name')

  // All locations with their customer_id so the modal can filter client-side
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, customer_id')
    .order('name')
  const availableCustomers = (customers ?? []) as Customer[]
  const availableLocations = (locations ?? []) as Location[]

  return (
    <AppShell>
      <PlanningBoard
        jobs={planningJobs}
        techs={assignableTechs}
        techsDiagnostic={techsDiagnostic}
        customers={availableCustomers}
        locations={availableLocations}
        today={today}
        addJobAction={addJob}
      />
    </AppShell>
  )
}
