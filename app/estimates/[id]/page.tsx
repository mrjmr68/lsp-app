import { redirect, notFound } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import EstimateDetail from './EstimateDetail'
import {
  EstimateAddOn,
  EstimateAdhocBundle,
  EstimateJob,
  EstimateRecord,
  PartsRequest,
  EstimateRepairBundle,
  ParentCustomer,
  EstimateTech,
} from '../types'
import { requireRole } from '@/utils/auth/roles'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : (value ?? null)
}

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, error } = await requireRole(['owner', 'admin'])
  if (error === 'Not authenticated') redirect('/login')
  if (error) redirect('/planning')

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, status, job_status, resolution_type, commercial_state, assigned_tech,
      manual_unit, problem_description, job_date, completed_at,
      customer_id, location_id, diagnosis_id, flat_rate_override, admin_notes,
      customers!jobs_customer_id_fkey(id, name, billing_email, bill_to_parent, parent_id),
      locations!jobs_location_id_fkey(id, name, tax_rate),
      units!jobs_unit_id_fkey(id, name, unit_type),
      systems!jobs_system_id_fkey(id, name, system_subtype, group_name, make, refrigerant_type, metering_device),
      diagnoses!jobs_diagnosis_id_fkey(id, repair_code, invoice_description, repair_notes),
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
    .eq('id', id)
    .single()

  if (jobError || !job) return notFound()

  let bundle = null
  if (job.diagnosis_id) {
    const { data } = await supabase
      .from('repair_bundles')
      .select(`
        id, diagnosis_id, name, flat_rate, repair_notes,
        repair_bundle_lines(id, quantity, cost_at_build, items(id, name, unit_cost))
      `)
      .eq('diagnosis_id', job.diagnosis_id)
      .order('created_at', { ascending: false })
      .limit(1)

    bundle = data?.[0] ?? null
  }

  const { data: adhocBundle } = await supabase
    .from('job_adhoc_bundles')
    .select('id, tech_description')
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: addOns } = await supabase
    .from('job_addons')
    .select(`
      id, type, quantity,
      repair_bundles(id, name, flat_rate),
      items(id, name, unit, unit_cost)
    `)
    .eq('job_id', id)

  const customer = firstRelation(job.customers)
  let parentCustomer = null
  if (customer?.bill_to_parent && customer?.parent_id) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, billing_email')
      .eq('id', customer.parent_id)
      .maybeSingle()
    parentCustomer = data
  }

  const estimate = firstRelation(job.job_estimates)
  const partsRequest = firstRelation(job.job_parts_requests)
  const normalizedAddOns = (addOns ?? []).map(addOn => ({
    ...addOn,
    repair_bundles: firstRelation(addOn.repair_bundles),
    items: firstRelation(addOn.items),
  }))

  const { data: techs } = await supabase
    .rpc('list_assignable_users')

  const { data: crewAssignments } = await supabase
    .from('job_tech')
    .select('user_id, role')
    .eq('job_id', id)

  const assistTechIds = (crewAssignments ?? [])
    .filter(assignment => assignment.role === 'assist')
    .map(assignment => assignment.user_id)
    .filter((value): value is string => !!value && value !== job.assigned_tech)

  let estimatePdfUrl: string | null = null
  if (estimate?.pdf_path) {
    const { data: signedUrlData } = await supabase.storage
      .from('estimate-pdfs')
      .createSignedUrl(estimate.pdf_path, 60 * 60)
    estimatePdfUrl = signedUrlData?.signedUrl ?? null
  }

  return (
    <AppShell>
      <EstimateDetail
        job={{
          ...job,
          customers: customer,
          locations: firstRelation(job.locations),
          units: firstRelation(job.units),
          systems: firstRelation(job.systems),
          diagnoses: firstRelation(job.diagnoses),
          users: firstRelation(job.users),
        } as EstimateJob}
        bundle={bundle as EstimateRepairBundle | null}
        adhocBundle={adhocBundle as EstimateAdhocBundle | null}
        addOns={normalizedAddOns as EstimateAddOn[]}
        estimate={estimate as EstimateRecord | null}
        partsRequest={partsRequest as PartsRequest | null}
        parentCustomer={parentCustomer as ParentCustomer | null}
        estimatePdfUrl={estimatePdfUrl}
        techs={(techs ?? []) as EstimateTech[]}
        assignedTechId={job.assigned_tech}
        assistTechIds={assistTechIds}
      />
    </AppShell>
  )
}
