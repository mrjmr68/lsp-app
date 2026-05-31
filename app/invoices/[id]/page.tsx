import { redirect, notFound } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import InvoiceDetail from './InvoiceDetail'
import { InvoiceAddOn, InvoiceAdhocBundle, InvoiceJob, InvoiceRepairBundle, InvoiceSnapshot, ParentCustomer, PhotoCounts, PlaceholderCost, VarianceData } from '../types'
import { requireRole } from '@/utils/auth/roles'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : (value ?? null)
}

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
      id, status, job_status, resolution_type, commercial_state,
      priority, manual_unit, problem_description,
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

  const { data: invoiceSnapshot } = await supabase
    .from('job_invoice_snapshots')
    .select(`
      id, job_id, invoice_number, invoice_date, source, send_to_email, cc_email,
      bill_to_name, bill_to_email, customer_name, location_name, unit_label, tech_name,
      service_date, reference_line, description_title, description_body, primary_label,
      line_items, subtotal, tax_rate, tax, total
    `)
    .eq('job_id', id)
    .maybeSingle()

  // 5. Parent customer (if bill_to_parent)
  let parentCustomer = null
  const cust = firstRelation(job.customers)
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
        .eq('commercial_state', 'invoiced')
        .not('invoice_amount', 'is', null)

    const amounts = ((historicalJobs ?? []) as Array<{ invoice_amount: number | null }>)
      .map(jobRow => jobRow.invoice_amount ?? 0)
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
  const photoCounts: PhotoCounts = { arrival: 0, fault: 0, post_repair: 0 }
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

  let invoicePdfUrl: string | null = null
  if (job.invoice_pdf_path) {
    const { data: signedUrlData } = await supabase.storage
      .from('invoice-pdfs')
      .createSignedUrl(job.invoice_pdf_path, 60 * 60)
    invoicePdfUrl = signedUrlData?.signedUrl ?? null
  }

  const normalizedAddOns = (addOns ?? []).map(addOn => ({
    ...addOn,
    repair_bundles: firstRelation(addOn.repair_bundles),
    items: firstRelation(addOn.items),
  }))

  const normalizedJob = {
    ...job,
    customers: firstRelation(job.customers),
    locations: firstRelation(job.locations),
    units: firstRelation(job.units),
    systems: firstRelation(job.systems),
    diagnoses: firstRelation(job.diagnoses),
    users: firstRelation(job.users),
    invoice_snapshot: (invoiceSnapshot ?? null) as InvoiceSnapshot | null,
  }

  return (
    <AppShell>
      <InvoiceDetail
        job={normalizedJob as InvoiceJob}
        bundle={bundle as InvoiceRepairBundle | null}
        adhocBundle={adhocBundle as InvoiceAdhocBundle | null}
        addOns={normalizedAddOns as InvoiceAddOn[]}
        placeholderCosts={(placeholderCosts ?? []) as PlaceholderCost[]}
        parentCustomer={parentCustomer as ParentCustomer | null}
        variance={variance as VarianceData | null}
        photoCounts={photoCounts}
        invoicePdfUrl={invoicePdfUrl}
      />
    </AppShell>
  )
}
