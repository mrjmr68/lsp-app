import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import EstimateQueue from './EstimateQueue'
import { EstimateQueueJob } from './types'
import { requireRole } from '@/utils/auth/roles'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : (value ?? null)
}

export default async function EstimatesPage() {
  const { supabase, error } = await requireRole(['owner', 'admin'])
  if (error === 'Not authenticated') redirect('/login')
  if (error) redirect('/planning')

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state,
      manual_unit, completed_at, needs_admin_review,
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
        pdf_path,
        generated_at,
        sent_at,
        approved_at
      ),
      job_parts_requests(
        id,
        vendor_name,
        vendor_email,
        eta_date,
        vendor_notes,
        email_subject,
        email_body,
        vendor_email_sent_at,
        ordered_at,
        ready_to_schedule_at,
        job_parts_request_lines(
          id,
          item_id,
          part_name,
          part_number,
          quantity,
          unit_cost,
          notes,
          ordered,
          sort_order
        )
      )
    `)
    .in('commercial_state', ['estimate_needed', 'estimate_sent', 'approval_pending', 'approved', 'parts_needed', 'parts_ordered', 'ready_to_schedule'])
    .order('completed_at', { ascending: false, nullsFirst: false })

  if (jobsError) {
    console.error('Estimate queue error:', jobsError.message, jobsError.details, jobsError.hint)
  }

  const normalizedJobs = (jobs ?? []).map(job => ({
    ...job,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
    units: firstRelation(job.units),
    diagnoses: firstRelation(job.diagnoses),
    users: firstRelation(job.users),
  }))

  return (
    <AppShell>
      <EstimateQueue jobs={normalizedJobs as EstimateQueueJob[]} />
    </AppShell>
  )
}
