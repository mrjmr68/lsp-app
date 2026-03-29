import { redirect, notFound } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import InvoiceDetail from './InvoiceDetail'
import { requireRole } from '@/utils/auth/roles'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, error } = await requireRole('owner')
  if (error === 'Not authenticated') redirect('/login')
  if (error) redirect('/planning')

  // 1. Job with ALL fields including pricing + admin + invoice
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select(`
      id, status, priority, manual_unit, problem_description,
      job_date, arrived_at, completed_at, how_it_came_in,
      tstat_mode, tstat_fan, system_response,
      temp_outdoor, temp_return, temp_supply,
      arrival_notes, diagnosis_id, needs_admin_review, new_diagnosis_requested,
      flagged_for_review, admin_notes, flat_rate_override,
      invoice_number, invoice_pdf_path, invoice_subtotal, invoice_tax, invoice_total,
      approved_at, approved_by, customer_id, location_id,
      customers!jobs_customer_id_fkey(id, name, type, billing_email, bill_to_parent, parent_id),
      locations!jobs_location_id_fkey(id, name, tax_rate),
      units!jobs_unit_id_fkey(id, name, unit_type),
      systems!jobs_system_id_fkey(
        id, name, system_subtype, group_name, tonnage,
        make, model, refrigerant_type, metering_device
      ),
      diagnoses!jobs_diagnosis_id_fkey(id, repair_code, invoice_description, repair_notes, variable_pricing),
      users!jobs_actual_tech_fkey(id, first_name, last_name)
    `)
    .eq('id', id)
    .single()

  if (jobErr || !job) return notFound()

  // 2. Repair bundle WITH pricing (flat_rate, lines with unit_cost, is_placeholder)
  let bundle = null
  if (job.diagnosis_id) {
    const { data } = await supabase
      .from('repair_bundles')
      .select(`
        id, diagnosis_id, name, flat_rate, repair_notes,
        repair_bundle_lines(id, quantity, cost_at_build, items(id, name, type, unit, unit_cost, is_placeholder))
      `)
      .eq('diagnosis_id', job.diagnosis_id)
      .order('created_at', { ascending: false })
      .limit(1)
    bundle = data?.[0] ?? null
  }

  const { data: adhocBundle } = await supabase
    .from('job_adhoc_bundles')
    .select(`
      id, tech_description, reviewed_by_admin, admin_action, promoted_diagnosis_id,
      job_adhoc_bundle_lines(id, quantity, cost_at_build, items(id, name, type, unit, unit_cost, is_placeholder))
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Job add-ons WITH pricing
  const { data: addOns } = await supabase
    .from('job_addons')
    .select(`
      id, type, quantity,
      repair_bundles(id, name, flat_rate),
      items(id, name, unit, unit_cost)
    `)
    .eq('job_id', id)

  // 4. Placeholder costs for this job
  const { data: placeholderCosts } = await supabase
    .from('job_placeholder_costs')
    .select('id, item_id, actual_cost')
    .eq('job_id', id)

  // 5. Parent customer (if bill_to_parent)
  let parentCustomer = null
  const cust = job.customers as any
  if (cust?.bill_to_parent && cust?.parent_id) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, billing_email')
      .eq('id', cust.parent_id)
      .maybeSingle()
    parentCustomer = data
  }

  // 6. Variance — historical invoice amounts for the same diagnosis
  let variance = null
  if (job.diagnosis_id) {
    const { data: historicalJobs } = await supabase
      .from('jobs')
      .select('invoice_amount')
      .eq('diagnosis_id', job.diagnosis_id)
      .eq('status', 'invoiced')
      .not('invoice_amount', 'is', null)

    const amounts = (historicalJobs ?? [])
      .map((j: any) => j.invoice_amount as number)
      .filter(a => a > 0)

    if (amounts.length > 0) {
      const sum = amounts.reduce((s: number, a: number) => s + a, 0)
      variance = {
        count: amounts.length,
        avg: Math.round((sum / amounts.length) * 100) / 100,
        min: Math.min(...amounts),
        max: Math.max(...amounts),
      }
    }
  }

  // 7. Photo counts from storage
  const photoCounts = { arrival: 0, fault: 0, post_repair: 0 }
  for (const type of ['observation', 'fault', 'post_repair'] as const) {
    const { data: files } = await supabase.storage
      .from('job-photos')
      .list(`${id}/${type}`)
    const count = (files ?? []).filter(f => !f.name.startsWith('.')).length
    if (type === 'observation') {
      photoCounts.arrival = count
    } else {
      photoCounts[type] = count
    }
  }

  // 8. App config
  const { data: configRows } = await supabase
    .from('app_config')
    .select('key, value')

  const appConfig = {
    labor_cost_per_hour: 0,
    travel_time_hours: 0,
    refrigerant_cost_per_lb: 0,
    profit_per_hour_target: 0,
  }
  for (const row of configRows ?? []) {
    if (row.key in appConfig) {
      (appConfig as any)[row.key] = Number(row.value) || 0
    }
  }

  let invoicePdfUrl: string | null = null
  if (job.invoice_pdf_path) {
    const { data: signedUrlData } = await supabase.storage
      .from('invoice-pdfs')
      .createSignedUrl(job.invoice_pdf_path, 60 * 60)
    invoicePdfUrl = signedUrlData?.signedUrl ?? null
  }

  return (
    <AppShell>
      <InvoiceDetail
        job={job as any}
        bundle={bundle as any}
        adhocBundle={adhocBundle as any}
        addOns={(addOns ?? []) as any}
        placeholderCosts={(placeholderCosts ?? []) as any}
        parentCustomer={parentCustomer as any}
        variance={variance}
        photoCounts={photoCounts}
        appConfig={appConfig}
        invoicePdfUrl={invoicePdfUrl}
      />
    </AppShell>
  )
}
