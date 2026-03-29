import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import JobList from './JobList'
import { addJob } from '@/app/planning/actions'

export default async function JobsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const { data: insertedProfiles } = await supabase
    .rpc('backfill_missing_user_profiles')

  if ((insertedProfiles ?? 0) > 0) {
    console.log(`Backfilled ${insertedProfiles} missing user profile(s) for jobs page.`)
  }

  // My assigned jobs for today
  const { data: myJobs } = await supabase
    .from('jobs')
    .select(`
      id, status, priority, manual_unit, problem_description,
      queue_position, arrived_at, access_confirmation_needed,
      customers!jobs_customer_id_fkey(name),
      locations!jobs_location_id_fkey(name),
      diagnoses!jobs_diagnosis_id_fkey(repair_code)
    `)
    .eq('assigned_tech', user.id)
    .eq('job_date', today)
    .not('status', 'in', '("invoiced","cancelled","completed")')
    .order('queue_position', { ascending: true, nullsFirst: false })

  // Completed jobs today (for the done section)
  const { data: doneJobs } = await supabase
    .from('jobs')
    .select(`
      id, status, priority, manual_unit,
      customers!jobs_customer_id_fkey(name),
      locations!jobs_location_id_fkey(name),
      diagnoses!jobs_diagnosis_id_fkey(repair_code)
    `)
    .eq('assigned_tech', user.id)
    .eq('job_date', today)
    .in('status', ['completed', 'closed_no_diagnosis'])

  // Unassigned jobs today
  const { data: unassignedJobs } = await supabase
    .from('jobs')
    .select(`
      id, status, priority, manual_unit, problem_description,
      customers!jobs_customer_id_fkey(name),
      locations!jobs_location_id_fkey(name)
    `)
    .is('assigned_tech', null)
    .eq('job_date', today)
    .not('status', 'in', '("invoiced","cancelled")')

  const { data: techs } = await supabase
    .rpc('list_assignable_users')

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, type')
    .order('name')

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, customer_id')
    .order('name')

  return (
    <AppShell>
      <JobList
        myJobs={(myJobs ?? []) as any}
        doneJobs={(doneJobs ?? []) as any}
        unassignedJobs={(unassignedJobs ?? []) as any}
        techs={(techs ?? []) as any}
        customers={(customers ?? []) as any}
        locations={(locations ?? []) as any}
        userId={user.id}
        addJobAction={addJob}
      />
    </AppShell>
  )
}
