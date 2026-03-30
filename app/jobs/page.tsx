import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import JobList, { Customer, ListJob, Location, Tech, UnassignedJob } from './JobList'
import { addJob } from '@/app/planning/actions'
import { DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES_FILTER } from '@/utils/job-lifecycle'
import { firstRelation } from '@/utils/supabase/relations'

export default async function JobsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const canViewAllClosedJobs = ['owner', 'admin', 'dispatcher'].includes(profile?.role ?? '')

  const { data: insertedProfiles } = await supabase
    .rpc('backfill_missing_user_profiles')

  if ((insertedProfiles ?? 0) > 0) {
    console.log(`Backfilled ${insertedProfiles} missing user profile(s) for jobs page.`)
  }

  // My assigned jobs for today
  const { data: myJobs } = await supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state,
      priority, manual_unit, problem_description,
      queue_position, arrived_at, access_confirmation_needed,
      customers!jobs_customer_id_fkey(name),
      locations!jobs_location_id_fkey(name),
      diagnoses!jobs_diagnosis_id_fkey(repair_code)
    `)
    .eq('assigned_tech', user.id)
    .eq('job_date', today)
    .neq('job_status', 'completed')
    .neq('job_status', 'cancelled')
    .not('commercial_state', 'in', DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES_FILTER)
    .order('queue_position', { ascending: true, nullsFirst: false })

  // Completed jobs today (for the done section)
  const { data: doneJobs } = await supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state,
      priority, manual_unit, problem_description,
      queue_position, arrived_at, access_confirmation_needed,
      customers!jobs_customer_id_fkey(name),
      locations!jobs_location_id_fkey(name),
      diagnoses!jobs_diagnosis_id_fkey(repair_code)
    `)
    .eq('assigned_tech', user.id)
    .eq('job_date', today)
    .eq('job_status', 'completed')
    .neq('commercial_state', 'invoiced')

  // Unassigned jobs today
  const { data: unassignedJobs } = await supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state,
      priority, manual_unit, problem_description,
      customers!jobs_customer_id_fkey(name),
      locations!jobs_location_id_fkey(name)
    `)
    .is('assigned_tech', null)
    .eq('job_date', today)
    .neq('job_status', 'cancelled')
    .not('commercial_state', 'in', DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES_FILTER)

  const { data: techs } = await supabase
    .rpc('list_assignable_users')

  let recentClosedJobsQuery = supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state,
      priority, manual_unit, problem_description,
      queue_position, arrived_at, access_confirmation_needed,
      job_date, completed_at,
      customers!jobs_customer_id_fkey(name),
      locations!jobs_location_id_fkey(name),
      diagnoses!jobs_diagnosis_id_fkey(repair_code)
    `)
    .eq('job_status', 'completed')
    .neq('job_date', today)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('job_date', { ascending: false })
    .limit(30)

  if (!canViewAllClosedJobs) {
    recentClosedJobsQuery = recentClosedJobsQuery.eq('assigned_tech', user.id)
  }

  const { data: recentClosedJobs } = await recentClosedJobsQuery

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, type')
    .order('name')

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, customer_id')
    .order('name')
  const normalizedMyJobs = (myJobs ?? []).map(job => ({
    ...job,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
    diagnoses: firstRelation(job.diagnoses),
  })) as ListJob[]
  const normalizedDoneJobs = (doneJobs ?? []).map(job => ({
    ...job,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
    diagnoses: firstRelation(job.diagnoses),
  })) as ListJob[]
  const normalizedRecentClosedJobs = (recentClosedJobs ?? []).map(job => ({
    ...job,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
    diagnoses: firstRelation(job.diagnoses),
  })) as ListJob[]
  const normalizedUnassignedJobs = (unassignedJobs ?? []).map(job => ({
    ...job,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
  })) as UnassignedJob[]
  const assignableTechs = (techs ?? []) as Tech[]
  const availableCustomers = (customers ?? []) as Customer[]
  const availableLocations = (locations ?? []) as Location[]

  return (
    <AppShell>
      <JobList
        myJobs={normalizedMyJobs}
        doneJobs={normalizedDoneJobs}
        recentClosedJobs={normalizedRecentClosedJobs}
        unassignedJobs={normalizedUnassignedJobs}
        techs={assignableTechs}
        customers={availableCustomers}
        locations={availableLocations}
        userId={user.id}
        addJobAction={addJob}
      />
    </AppShell>
  )
}
