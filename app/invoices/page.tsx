import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import InvoiceQueue from './InvoiceQueue'
import { InvoiceQueueJob } from './types'
import { requireRole } from '@/utils/auth/roles'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : (value ?? null)
}

export default async function InvoicesPage() {
  const { supabase, error } = await requireRole('owner')
  if (error === 'Not authenticated') redirect('/login')
  if (error) redirect('/planning')

  // Pending-review jobs (completed + needs admin review)
  const { data: pendingJobs, error: jobsError } = await supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state,
      priority, manual_unit, job_date, completed_at,
      needs_admin_review, flagged_for_review, diagnosis_id,
      customers!jobs_customer_id_fkey(id, name),
      locations!jobs_location_id_fkey(id, name),
      units!jobs_unit_id_fkey(id, name),
      diagnoses!jobs_diagnosis_id_fkey(id, repair_code),
      users!jobs_actual_tech_fkey(id, first_name, last_name),
      job_estimates(
        id,
        estimate_number,
        status,
        customer_summary,
        scope_of_work,
        line_items,
        subtotal,
        tax_rate,
        tax,
        total,
        send_to_email,
        cc_email,
        generated_at,
        sent_at,
        approved_at
      )
    `)
    .eq('job_status', 'completed')
    .eq('commercial_state', 'ready_for_invoice')
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
  const placeholderDiagnosisIds = new Set<string>()
  if (diagnosisIds.length > 0) {
    const { data: bundles } = await supabase
      .from('repair_bundles')
      .select('diagnosis_id, repair_bundle_lines(items(is_placeholder))')
      .in('diagnosis_id', diagnosisIds)

    type BundleWithPlaceholderLines = {
      diagnosis_id: string
      repair_bundle_lines: Array<{
        items: { is_placeholder: boolean }[] | { is_placeholder: boolean } | null
      }> | null
    }

    for (const b of (bundles ?? []) as BundleWithPlaceholderLines[]) {
      const lines = b.repair_bundle_lines ?? []
      const hasPlaceholder = lines.some(line => firstRelation(line.items)?.is_placeholder)
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

  const normalizedPendingJobs = (pendingJobs ?? []).map(job => ({
    ...job,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
    units: firstRelation(job.units),
    diagnoses: firstRelation(job.diagnoses),
    users: firstRelation(job.users),
  }))

  return (
    <AppShell>
      <InvoiceQueue
        jobs={normalizedPendingJobs as InvoiceQueueJob[]}
        blockerMap={blockerMap}
      />
    </AppShell>
  )
}
