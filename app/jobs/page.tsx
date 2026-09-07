import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TodayView, type TodayJob } from './TodayView'
import { DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES_FILTER } from '@/utils/job-lifecycle'
import { firstRelation } from '@/utils/supabase/relations'

export default async function JobsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const { data: insertedProfiles } = await supabase.rpc('backfill_missing_user_profiles')
  if ((insertedProfiles ?? 0) > 0) {
    console.log(`Backfilled ${insertedProfiles} missing user profile(s) for jobs page.`)
  }

  const [{ data: profile }, { data: myJobs }] = await Promise.all([
    supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('jobs')
      .select(`
        id, job_status, problem_description, queue_position,
        customers!jobs_customer_id_fkey(name),
        locations!jobs_location_id_fkey(name)
      `)
      .eq('assigned_tech', user.id)
      .eq('job_date', today)
      .neq('job_status', 'completed')
      .neq('job_status', 'cancelled')
      .not('commercial_state', 'in', DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES_FILTER)
      .order('queue_position', { ascending: true, nullsFirst: false }),
  ])

  const openJobs: TodayJob[] = (myJobs ?? []).map(job => ({
    id: job.id,
    problem_description: job.problem_description,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
  }))

  const live = (myJobs ?? []).find(job =>
    job.job_status === 'on_site' || job.job_status === 'follow_up_active',
  )
  const nextJob = (live ? openJobs.find(job => job.id === live.id) : openJobs[0]) ?? null
  const laterJobs = openJobs.filter(job => job.id !== nextJob?.id)
  const techName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')

  return (
    <TodayView
      techName={techName || 'there'}
      nextJob={nextJob}
      laterJobs={laterJobs}
    />
  )
}
