import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import PlanningBoard from './PlanningBoard'
import { addJob } from './actions'

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
    .not('status', 'in', '("invoiced","cancelled")')
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

  return (
    <AppShell>
      <PlanningBoard
        jobs={(jobs ?? []) as any}
        techs={techs ?? []}
        techsDiagnostic={techsDiagnostic}
        customers={customers ?? []}
        locations={locations ?? []}
        today={today}
        addJobAction={addJob}
      />
    </AppShell>
  )
}
