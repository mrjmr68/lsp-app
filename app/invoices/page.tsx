import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import InvoiceQueue from './InvoiceQueue'
import { requireRole } from '@/utils/auth/roles'

export default async function InvoicesPage() {
  const { supabase, error } = await requireRole('owner')
  if (error === 'Not authenticated') redirect('/login')
  if (error) redirect('/planning')

  // Pending-review jobs (completed + needs admin review)
  const { data: pendingJobs, error: jobsError } = await supabase
    .from('jobs')
    .select(`
      id, status, priority, manual_unit, job_date, completed_at,
      needs_admin_review, flagged_for_review, diagnosis_id,
      customers!jobs_customer_id_fkey(id, name),
      locations!jobs_location_id_fkey(id, name),
      units!jobs_unit_id_fkey(id, name),
      diagnoses!jobs_diagnosis_id_fkey(id, repair_code),
      users!jobs_actual_tech_fkey(id, first_name, last_name)
    `)
    .eq('status', 'completed')
    .eq('needs_admin_review', true)
    .order('completed_at', { ascending: false })

  if (jobsError) {
    console.error('Invoice queue error:', jobsError.message, jobsError.details, jobsError.hint)
  }

  // Detect placeholder blockers:
  // 1. Gather diagnosis IDs from pending jobs
  const diagnosisIds = (pendingJobs ?? [])
    .filter(j => j.diagnosis_id)
    .map(j => j.diagnosis_id as string)

  // 2. Find bundles that contain placeholder items
  let placeholderDiagnosisIds: Set<string> = new Set()
  if (diagnosisIds.length > 0) {
    const { data: bundles } = await supabase
      .from('repair_bundles')
      .select('diagnosis_id, repair_bundle_lines(items(is_placeholder))')
      .in('diagnosis_id', diagnosisIds)

    for (const b of bundles ?? []) {
      const lines = (b as any).repair_bundle_lines ?? []
      const hasPlaceholder = lines.some((l: any) => l.items?.is_placeholder)
      if (hasPlaceholder) placeholderDiagnosisIds.add(b.diagnosis_id)
    }
  }

  // 3. Check which jobs already have placeholder costs entered
  const jobIds = (pendingJobs ?? []).map(j => j.id)
  const { data: existingCosts } = jobIds.length > 0
    ? await supabase
        .from('job_placeholder_costs')
        .select('job_id, item_id, actual_cost')
        .in('job_id', jobIds)
    : { data: [] }

  // Build blocker map: jobId → boolean (true = needs cost entry)
  const costsByJob = new Map<string, Set<string>>()
  for (const c of existingCosts ?? []) {
    if (c.actual_cost != null && c.actual_cost > 0) {
      if (!costsByJob.has(c.job_id)) costsByJob.set(c.job_id, new Set())
      costsByJob.get(c.job_id)!.add(c.item_id)
    }
  }

  const blockerMap: Record<string, boolean> = {}
  for (const j of pendingJobs ?? []) {
    if (j.diagnosis_id && placeholderDiagnosisIds.has(j.diagnosis_id)) {
      // Job has placeholder items — check if all have costs entered
      // For simplicity, mark as blocked if diagnosis has placeholders
      // and we don't have costs for ALL of them for this job.
      // A full check would compare specific item_ids, but this is good enough
      // for the queue pill. The detail page does the full check.
      const filledCount = costsByJob.get(j.id)?.size ?? 0
      blockerMap[j.id] = filledCount === 0  // rough check
    }
  }

  return (
    <AppShell>
      <InvoiceQueue
        jobs={(pendingJobs ?? []) as any}
        blockerMap={blockerMap}
      />
    </AppShell>
  )
}
