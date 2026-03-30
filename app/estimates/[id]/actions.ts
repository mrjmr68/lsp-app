'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/utils/auth/roles'
import { buildEstimatePdf } from '@/utils/estimates/document'
import { getLegacyStatusFromLifecycle } from '@/utils/job-lifecycle'
import { sendVendorEmail } from '@/utils/parts/email'

type EstimateDraftInput = {
  customerSummary: string
  scopeOfWork: string
  sendToEmail: string
  ccEmail: string
  primaryAmount: number | null
}

type PartsDraftLineInput = {
  id?: string | null
  partName: string
  partNumber: string
  quantity: number | null
  unitCost: number | null
  notes: string
  ordered: boolean
}

type PartsDraftInput = {
  vendorName: string
  vendorEmail: string
  etaDate: string
  vendorNotes: string
  emailSubject: string
  emailBody: string
  lines: PartsDraftLineInput[]
}

type FollowUpScheduleInput = {
  scheduledDate: string
  assignedTechId: string
  assistTechIds: string[]
}

type EstimateContext = {
  job: {
    id: string
    diagnosis_id: string | null
    flat_rate_override: number | null
    manual_unit: string | null
    job_date: string
    problem_description: string | null
    commercial_state: string
    customers: {
      id: string
      name: string
      billing_email: string | null
      bill_to_parent: boolean
      parent_id: string | null
    } | null
    locations: {
      id: string
      name: string
      tax_rate: number | null
    } | null
    units: {
      id: string
      name: string
      unit_type: string
    } | null
    diagnoses: {
      id: string
      repair_code: string
      invoice_description: string | null
      repair_notes: string | null
    } | null
    users: {
      id: string
      first_name: string
      last_name: string
    } | null
  }
  bundle: {
    id: string
    name: string
    flat_rate: number
    repair_notes: string | null
  } | null
  adhocBundle: {
    id: string
    tech_description: string
  } | null
  addOns: Array<{
    id: string
    type: 'bundle' | 'item'
    quantity: number
    repair_bundles: { id: string; name: string; flat_rate: number } | null
    items: { id: string; name: string; unit_cost: number } | null
  }>
  existingEstimate: {
    id: string
    estimate_number: string | null
    status: 'draft' | 'sent' | 'approved' | 'declined'
    pdf_path: string | null
    generated_at: string | null
    generated_by: string | null
    sent_at: string | null
    sent_by: string | null
    approved_at: string | null
    approved_by: string | null
  } | null
  parentCustomer: {
    id: string
    name: string
    billing_email: string | null
  } | null
  partsRequest: {
    id: string
    vendor_name: string | null
    vendor_email: string | null
    eta_date: string | null
    vendor_notes: string | null
    email_subject: string | null
    email_body: string | null
    vendor_email_sent_at: string | null
    vendor_email_sent_by: string | null
    ordered_at: string | null
    ordered_by: string | null
    ready_to_schedule_at: string | null
    ready_to_schedule_by: string | null
    job_parts_request_lines: Array<{
      id: string
      item_id: string | null
      part_name: string
      part_number: string | null
      quantity: number
      unit_cost: number | null
      notes: string | null
      ordered: boolean
      sort_order: number
    }>
  } | null
}

type PartsRequestSnapshotResult = {
  error: string | null
  requestId: string | null
  emailSubject?: string
  emailBody?: string
  normalizedLines?: ReturnType<typeof normalizePartsLines>
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : (value ?? null)
}

function normalizeEstimateAddOns(addOns: EstimateContext['addOns']) {
  return addOns.map(addOn => ({
    ...addOn,
    repair_bundles: firstRelation(addOn.repair_bundles),
    items: firstRelation(addOn.items),
  }))
}

async function requireEstimateManager() {
  return requireRole(['owner', 'admin'])
}

async function nextEstimateNumber(supabase: Awaited<ReturnType<typeof requireEstimateManager>>['supabase']) {
  const year = new Date().getFullYear()
  const { data: latest, error } = await supabase
    .from('job_estimates')
    .select('estimate_number')
    .like('estimate_number', `EST-${year}-%`)
    .order('estimate_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: error.message, estimateNumber: null as string | null }
  }

  const latestNumber = latest?.estimate_number ?? null
  const latestSeq = latestNumber ? Number(latestNumber.split('-').at(-1) ?? '0') : 0
  const seq = String(latestSeq + 1).padStart(4, '0')
  return { estimateNumber: `EST-${year}-${seq}`, error: null as string | null }
}

async function loadEstimateContext(
  supabase: Awaited<ReturnType<typeof requireEstimateManager>>['supabase'],
  jobId: string,
) {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id, diagnosis_id, flat_rate_override, manual_unit, job_date, problem_description, commercial_state,
      customers!jobs_customer_id_fkey(id, name, billing_email, bill_to_parent, parent_id),
      locations!jobs_location_id_fkey(id, name, tax_rate),
      units!jobs_unit_id_fkey(id, name, unit_type),
      diagnoses!jobs_diagnosis_id_fkey(id, repair_code, invoice_description, repair_notes),
      users!jobs_actual_tech_fkey(id, first_name, last_name)
    `)
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return { error: jobError?.message ?? 'Job not found.', context: null as EstimateContext | null }
  }

  const { data: existingEstimate, error: existingEstimateError } = await supabase
    .from('job_estimates')
    .select('id, estimate_number, status, pdf_path, generated_at, generated_by, sent_at, sent_by, approved_at, approved_by')
    .eq('job_id', jobId)
    .maybeSingle()

  if (existingEstimateError) {
    return { error: existingEstimateError.message, context: null as EstimateContext | null }
  }

  const { data: partsRequest, error: partsRequestError } = await supabase
    .from('job_parts_requests')
    .select(`
      id, vendor_name, vendor_email, eta_date, vendor_notes,
      email_subject, email_body,
      vendor_email_sent_at, vendor_email_sent_by,
      ordered_at, ordered_by,
      ready_to_schedule_at, ready_to_schedule_by,
      job_parts_request_lines(
        id, item_id, part_name, part_number, quantity, unit_cost, notes, ordered, sort_order
      )
    `)
    .eq('job_id', jobId)
    .maybeSingle()

  if (partsRequestError) {
    return { error: partsRequestError.message, context: null as EstimateContext | null }
  }

  let bundle = null
  if (job.diagnosis_id) {
    const { data: bundles, error: bundleError } = await supabase
      .from('repair_bundles')
      .select('id, name, flat_rate, repair_notes')
      .eq('diagnosis_id', job.diagnosis_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (bundleError) {
      return { error: bundleError.message, context: null as EstimateContext | null }
    }

    bundle = bundles?.[0] ?? null
  }

  const { data: adhocBundle, error: adhocBundleError } = await supabase
    .from('job_adhoc_bundles')
    .select('id, tech_description')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (adhocBundleError) {
    return { error: adhocBundleError.message, context: null as EstimateContext | null }
  }

  const { data: addOns, error: addOnError } = await supabase
    .from('job_addons')
    .select('id, type, quantity, repair_bundles(id, name, flat_rate), items(id, name, unit_cost)')
    .eq('job_id', jobId)

  if (addOnError) {
    return { error: addOnError.message, context: null as EstimateContext | null }
  }

  const customer = firstRelation(job.customers)
  let parentCustomer = null
  if (customer?.bill_to_parent && customer.parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('customers')
      .select('id, name, billing_email')
      .eq('id', customer.parent_id)
      .maybeSingle()

    if (parentError) {
      return { error: parentError.message, context: null as EstimateContext | null }
    }
    parentCustomer = parent
  }

  return {
    error: null as string | null,
    context: {
      job: {
        ...job,
        customers: customer,
        locations: firstRelation(job.locations),
        units: firstRelation(job.units),
        diagnoses: firstRelation(job.diagnoses),
        users: firstRelation(job.users),
      },
      bundle,
      adhocBundle,
      addOns: normalizeEstimateAddOns((addOns ?? []) as unknown as EstimateContext['addOns']),
      existingEstimate: existingEstimate ?? null,
      parentCustomer,
      partsRequest: partsRequest ?? null,
    } satisfies EstimateContext,
  }
}

function buildEstimateSnapshot(context: EstimateContext, input: EstimateDraftInput) {
  const diagnosis = context.job.diagnoses
  const customer = context.job.customers
  const location = context.job.locations
  const unit = context.job.units
  const tech = context.job.users
  const billTo = context.parentCustomer ?? customer

  const trimmedSummary = input.customerSummary.trim()
  const trimmedScope = input.scopeOfWork.trim()

  const primaryAmount = input.primaryAmount ?? context.job.flat_rate_override ?? context.bundle?.flat_rate ?? null
  if (primaryAmount == null || primaryAmount <= 0) {
    return { error: 'Enter an estimate amount before saving this estimate.', snapshot: null as null }
  }

  const primaryLabel = diagnosis?.repair_code
    ?? context.bundle?.name
    ?? (context.adhocBundle ? 'Ad-hoc repair estimate' : 'Repair estimate')

  const customerSummary = trimmedSummary
    || diagnosis?.invoice_description
    || diagnosis?.repair_code
    || 'Repair recommendation'

  const scopeOfWork = trimmedScope
    || diagnosis?.repair_notes
    || context.bundle?.repair_notes
    || context.adhocBundle?.tech_description
    || context.job.problem_description
    || 'Repair scope to be completed per site visit findings.'

  const addOnLines = context.addOns.map(addOn => ({
    label: addOn.type === 'bundle'
      ? (firstRelation(addOn.repair_bundles)?.name ?? 'Additional bundle')
      : (firstRelation(addOn.items)?.name ?? 'Additional item'),
    amount: addOn.type === 'bundle'
      ? (firstRelation(addOn.repair_bundles)?.flat_rate ?? 0)
      : (firstRelation(addOn.items)?.unit_cost ?? 0) * addOn.quantity,
  }))

  const lineItems = [{ label: primaryLabel, amount: primaryAmount }, ...addOnLines]
  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100
  const taxRate = location?.tax_rate ?? 0
  const tax = Math.round(subtotal * taxRate * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100

  return {
    error: null as string | null,
    snapshot: {
      billTo,
      location,
      unit,
      tech,
      customer,
      customerSummary,
      scopeOfWork,
      lineItems,
      subtotal,
      taxRate,
      tax,
      total,
    },
  }
}

async function saveEstimateSnapshot(
  supabase: Awaited<ReturnType<typeof requireEstimateManager>>['supabase'],
  userId: string,
  context: EstimateContext,
  input: EstimateDraftInput,
  options?: {
    ensurePdf?: boolean
    nextStatus?: 'draft' | 'sent' | 'approved' | 'declined'
    markSent?: boolean
    markApproved?: boolean
  },
) {
  const snapshotResult = buildEstimateSnapshot(context, input)
  if (snapshotResult.error || !snapshotResult.snapshot) {
    return { error: snapshotResult.error ?? 'Estimate could not be built.', estimateNumber: null as string | null }
  }

  const nextOverride = input.primaryAmount
  if ((context.job.flat_rate_override ?? null) !== nextOverride) {
    const { error: overrideError } = await supabase
      .from('jobs')
      .update({ flat_rate_override: nextOverride })
      .eq('id', context.job.id)

    if (overrideError) {
      return { error: overrideError.message, estimateNumber: null as string | null }
    }
  }

  let estimateNumber = context.existingEstimate?.estimate_number ?? null
  let pdfPath = context.existingEstimate?.pdf_path ?? null

  if (options?.ensurePdf) {
    if (!estimateNumber) {
      const numberResult = await nextEstimateNumber(supabase)
      if (numberResult.error || !numberResult.estimateNumber) {
        return { error: numberResult.error ?? 'Failed to allocate estimate number.', estimateNumber: null as string | null }
      }
      estimateNumber = numberResult.estimateNumber
    }

    pdfPath = `${new Date().getFullYear()}/${safeSegment(estimateNumber)}.pdf`
    const pdfBytes = buildEstimatePdf({
      estimateNumber,
      estimateDate: formatDate(new Date().toISOString()),
      fromName: 'Legend Service Pros',
      fromCityState: 'Greensboro, NC',
      billToName: snapshotResult.snapshot.billTo?.name ?? snapshotResult.snapshot.customer?.name ?? 'Customer',
      billToEmail: input.sendToEmail.trim() || snapshotResult.snapshot.billTo?.billing_email || null,
      customerName: snapshotResult.snapshot.customer?.name ?? 'Customer',
      locationName: snapshotResult.snapshot.location?.name ?? 'Location',
      unitLabel: context.job.manual_unit ?? snapshotResult.snapshot.unit?.name ?? '-',
      techName: snapshotResult.snapshot.tech
        ? `${snapshotResult.snapshot.tech.first_name} ${snapshotResult.snapshot.tech.last_name}`
        : '-',
      serviceDate: formatDate(context.job.job_date),
      summaryTitle: snapshotResult.snapshot.customerSummary,
      summaryBody: snapshotResult.snapshot.scopeOfWork,
      lineItems: snapshotResult.snapshot.lineItems,
      subtotal: snapshotResult.snapshot.subtotal,
      taxRate: snapshotResult.snapshot.taxRate,
      tax: snapshotResult.snapshot.tax,
      total: snapshotResult.snapshot.total,
    })

    const { error: uploadError } = await supabase.storage
      .from('estimate-pdfs')
      .upload(pdfPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      return { error: `Estimate PDF upload failed: ${uploadError.message}`, estimateNumber: null as string | null }
    }
  }

  const now = new Date().toISOString()
  const nextStatus = options?.nextStatus ?? context.existingEstimate?.status ?? 'draft'

  const payload = {
    job_id: context.job.id,
    estimate_number: estimateNumber,
    status: nextStatus,
    customer_summary: snapshotResult.snapshot.customerSummary,
    scope_of_work: snapshotResult.snapshot.scopeOfWork,
    line_items: snapshotResult.snapshot.lineItems,
    subtotal: snapshotResult.snapshot.subtotal,
    tax_rate: snapshotResult.snapshot.taxRate,
    tax: snapshotResult.snapshot.tax,
    total: snapshotResult.snapshot.total,
    send_to_email: input.sendToEmail.trim() || snapshotResult.snapshot.billTo?.billing_email || null,
    cc_email: input.ccEmail.trim() || null,
    pdf_path: pdfPath,
    generated_at: options?.ensurePdf ? now : context.existingEstimate?.generated_at ?? null,
    generated_by: options?.ensurePdf ? userId : context.existingEstimate?.generated_by ?? null,
    sent_at: options?.markSent ? now : context.existingEstimate?.sent_at ?? null,
    sent_by: options?.markSent ? userId : context.existingEstimate?.sent_by ?? null,
    approved_at: options?.markApproved ? now : context.existingEstimate?.approved_at ?? null,
    approved_by: options?.markApproved ? userId : context.existingEstimate?.approved_by ?? null,
    updated_at: now,
  }

  const { error: estimateError } = await supabase
    .from('job_estimates')
    .upsert(payload, { onConflict: 'job_id' })

  if (estimateError) {
    return { error: estimateError.message, estimateNumber: null as string | null }
  }

  return { error: null as string | null, estimateNumber }
}

function revalidateEstimatePaths(jobId: string) {
  revalidatePath('/estimates')
  revalidatePath(`/estimates/${jobId}`)
  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath('/planning')
}

function normalizeAssistTechIds(assistTechIds: string[], assignedTechId: string) {
  return Array.from(new Set(
    assistTechIds
      .map(value => value.trim())
      .filter(value => !!value && value !== assignedTechId),
  ))
}

async function syncPlanningAssistTechs(
  supabase: Awaited<ReturnType<typeof requireEstimateManager>>['supabase'],
  jobId: string,
  assistTechIds: string[],
) {
  const { error } = await supabase.rpc('set_job_planning_assists', {
    p_job_id: jobId,
    p_assist_ids: assistTechIds,
  })

  return error?.message ?? null
}

async function nextQueuePositionForTechDate(
  supabase: Awaited<ReturnType<typeof requireEstimateManager>>['supabase'],
  assignedTechId: string,
  scheduledDate: string,
) {
  const { data: existing, error } = await supabase
    .from('jobs')
    .select('queue_position')
    .eq('assigned_tech', assignedTechId)
    .eq('job_date', scheduledDate)
    .order('queue_position', { ascending: false })
    .limit(1)

  if (error) {
    return { error: error.message, queuePosition: null as number | null }
  }

  return {
    error: null as string | null,
    queuePosition: existing?.[0]?.queue_position ? existing[0].queue_position + 1 : 1,
  }
}

function normalizePartsLines(input: PartsDraftInput['lines']) {
  return input
    .map((line, index) => ({
      id: line.id ?? null,
      part_name: line.partName.trim(),
      part_number: line.partNumber.trim() || null,
      quantity: line.quantity != null && Number.isFinite(line.quantity) && line.quantity > 0 ? Math.round(line.quantity * 100) / 100 : 0,
      unit_cost: line.unitCost != null && Number.isFinite(line.unitCost) ? Math.round(line.unitCost * 100) / 100 : null,
      notes: line.notes.trim() || null,
      ordered: !!line.ordered,
      sort_order: index + 1,
    }))
    .filter(line => line.part_name && line.quantity > 0)
}

function buildDefaultVendorEmailSubject(context: EstimateContext) {
  const customerName = context.job.customers?.name ?? 'Customer'
  const locationName = context.job.locations?.name ?? 'Location'
  return `Parts request - ${customerName} - ${locationName}`
}

function buildDefaultVendorEmailBody(context: EstimateContext, lines: ReturnType<typeof normalizePartsLines>) {
  const intro = [
    'Hello,',
    '',
    `Please quote or confirm availability for the following parts for ${context.job.customers?.name ?? 'this job'} at ${context.job.locations?.name ?? 'the site below'}.`,
    '',
    `Job: ${context.job.customers?.name ?? 'Customer'} - ${context.job.locations?.name ?? 'Location'}${context.job.manual_unit ? ` - ${context.job.manual_unit}` : ''}`,
    `Diagnosis: ${context.job.diagnoses?.repair_code ?? 'Repair estimate'}`,
    '',
    'Needed parts:',
  ]

  const lineText = lines.map(line => {
    const details = [line.part_name, line.part_number ? `PN ${line.part_number}` : null, `Qty ${line.quantity}`].filter(Boolean).join(' - ')
    return `- ${details}`
  })

  return [...intro, ...lineText, '', 'Thank you,'].join('\n')
}

function buildVendorEmailHtml(body: string) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f1e7;padding:24px;color:#1a1a18;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e1da;">
        ${body
          .split('\n')
          .map(line => `<div style="font-size:14px;line-height:1.65;color:#3d3b36;margin-bottom:${line ? '6px' : '14px'};">${line || '&nbsp;'}</div>`)
          .join('')}
      </div>
    </div>
  `.trim()
}

async function savePartsRequestSnapshot(
  supabase: Awaited<ReturnType<typeof requireEstimateManager>>['supabase'],
  userId: string,
  context: EstimateContext,
  input: PartsDraftInput,
  options?: {
    markVendorEmailed?: boolean
    markOrdered?: boolean
    markReadyToSchedule?: boolean
  },
): Promise<PartsRequestSnapshotResult> {
  const normalizedLines = normalizePartsLines(input.lines)
  if (normalizedLines.length === 0) {
    return { error: 'Add at least one needed part line before saving.', requestId: null as string | null }
  }

  const now = new Date().toISOString()
  const subject = input.emailSubject.trim() || buildDefaultVendorEmailSubject(context)
  const body = input.emailBody.trim() || buildDefaultVendorEmailBody(context, normalizedLines)

  let requestId = context.partsRequest?.id ?? null

  const requestPayload = {
    job_id: context.job.id,
    vendor_name: input.vendorName.trim() || null,
    vendor_email: input.vendorEmail.trim() || null,
    eta_date: input.etaDate.trim() || null,
    vendor_notes: input.vendorNotes.trim() || null,
    email_subject: subject,
    email_body: body,
    vendor_email_sent_at: options?.markVendorEmailed ? now : context.partsRequest?.vendor_email_sent_at ?? null,
    vendor_email_sent_by: options?.markVendorEmailed ? userId : context.partsRequest?.vendor_email_sent_by ?? null,
    ordered_at: options?.markOrdered ? now : context.partsRequest?.ordered_at ?? null,
    ordered_by: options?.markOrdered ? userId : context.partsRequest?.ordered_by ?? null,
    ready_to_schedule_at: options?.markReadyToSchedule ? now : context.partsRequest?.ready_to_schedule_at ?? null,
    ready_to_schedule_by: options?.markReadyToSchedule ? userId : context.partsRequest?.ready_to_schedule_by ?? null,
  }

  const { data: savedRequest, error: requestError } = requestId
    ? await supabase
        .from('job_parts_requests')
        .update(requestPayload)
        .eq('id', requestId)
        .select('id')
        .single()
    : await supabase
        .from('job_parts_requests')
        .insert(requestPayload)
        .select('id')
        .single()

  if (requestError || !savedRequest) {
    return { error: requestError?.message ?? 'Parts request could not be saved.', requestId: null as string | null }
  }

  requestId = savedRequest.id

  const existingLineIds = (context.partsRequest?.job_parts_request_lines ?? []).map(line => line.id)
  if (existingLineIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('job_parts_request_lines')
      .delete()
      .in('id', existingLineIds)

    if (deleteError) {
      return { error: deleteError.message, requestId: null as string | null }
    }
  }

  const { error: insertLinesError } = await supabase
    .from('job_parts_request_lines')
    .insert(
      normalizedLines.map(line => ({
        request_id: requestId,
        item_id: null,
        part_name: line.part_name,
        part_number: line.part_number,
        quantity: line.quantity,
        unit_cost: line.unit_cost,
        notes: line.notes,
        ordered: line.ordered,
        sort_order: line.sort_order,
      })),
    )

  if (insertLinesError) {
    return { error: insertLinesError.message, requestId: null as string | null }
  }

  return {
    error: null as string | null,
    requestId,
    emailSubject: subject,
    emailBody: body,
    normalizedLines,
  }
}

export async function saveEstimateDraft(jobId: string, input: EstimateDraftInput) {
  const { supabase, user, error: authError } = await requireEstimateManager()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  const contextResult = await loadEstimateContext(supabase, jobId)
  if (contextResult.error || !contextResult.context) {
    return { error: contextResult.error ?? 'Estimate context could not be loaded.' }
  }

  const result = await saveEstimateSnapshot(supabase, user.id, contextResult.context, input)
  if (result.error) return { error: result.error }

  revalidateEstimatePaths(jobId)
  return { success: true }
}

export async function generateEstimatePdf(jobId: string, input: EstimateDraftInput) {
  const { supabase, user, error: authError } = await requireEstimateManager()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  const contextResult = await loadEstimateContext(supabase, jobId)
  if (contextResult.error || !contextResult.context) {
    return { error: contextResult.error ?? 'Estimate context could not be loaded.' }
  }

  const result = await saveEstimateSnapshot(supabase, user.id, contextResult.context, input, {
    ensurePdf: true,
  })

  if (result.error) return { error: result.error }

  revalidateEstimatePaths(jobId)
  return { success: true, estimateNumber: result.estimateNumber }
}

export async function markEstimateSent(jobId: string, input: EstimateDraftInput) {
  const { supabase, user, error: authError } = await requireEstimateManager()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  if (!input.sendToEmail.trim()) {
    return { error: 'A customer email is required before marking the estimate sent.' }
  }

  const contextResult = await loadEstimateContext(supabase, jobId)
  if (contextResult.error || !contextResult.context) {
    return { error: contextResult.error ?? 'Estimate context could not be loaded.' }
  }

  const result = await saveEstimateSnapshot(supabase, user.id, contextResult.context, input, {
    ensurePdf: true,
    nextStatus: 'sent',
    markSent: true,
  })

  if (result.error) return { error: result.error }

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      commercial_state: 'approval_pending',
      needs_admin_review: false,
    })
    .eq('id', jobId)

  if (jobError) return { error: jobError.message }

  revalidateEstimatePaths(jobId)
  return { success: true }
}

export async function markEstimateApproved(jobId: string) {
  const { supabase, user, error: authError } = await requireEstimateManager()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  const { data: estimate, error: estimateError } = await supabase
    .from('job_estimates')
    .select('id')
    .eq('job_id', jobId)
    .maybeSingle()

  if (estimateError) return { error: estimateError.message }
  if (!estimate) return { error: 'Generate the estimate PDF before marking it approved.' }

  const now = new Date().toISOString()

  const { error: updateEstimateError } = await supabase
    .from('job_estimates')
    .update({
      status: 'approved',
      approved_at: now,
      approved_by: user.id,
    })
    .eq('job_id', jobId)

  if (updateEstimateError) return { error: updateEstimateError.message }

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      commercial_state: 'approved',
      needs_admin_review: false,
    })
    .eq('id', jobId)

  if (jobError) return { error: jobError.message }

  revalidateEstimatePaths(jobId)
  return { success: true }
}

export async function savePartsDraft(jobId: string, input: PartsDraftInput) {
  const { supabase, user, error: authError } = await requireEstimateManager()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  const contextResult = await loadEstimateContext(supabase, jobId)
  if (contextResult.error || !contextResult.context) {
    return { error: contextResult.error ?? 'Parts context could not be loaded.' }
  }

  const context = contextResult.context
  if (!['approved', 'parts_needed', 'parts_ordered', 'ready_to_schedule'].includes(context.job.commercial_state)) {
    return { error: 'Approve the estimate before moving this job into parts sourcing.' }
  }

  const result = await savePartsRequestSnapshot(supabase, user.id, context, input)
  if (result.error) return { error: result.error }

  const nextCommercialState =
    context.job.commercial_state === 'parts_ordered' || context.job.commercial_state === 'ready_to_schedule'
      ? context.job.commercial_state
      : 'parts_needed'

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      resolution_type: 'parts_sourcing',
      job_status: 'follow_up_planning',
      commercial_state: nextCommercialState,
      needs_admin_review: false,
    })
    .eq('id', jobId)

  if (jobError) return { error: jobError.message }

  revalidateEstimatePaths(jobId)
  return { success: true }
}

export async function sendPartsVendorEmailAction(jobId: string, input: PartsDraftInput) {
  const { supabase, user, error: authError } = await requireEstimateManager()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  if (!input.vendorEmail.trim()) {
    return { error: 'A vendor email is required before sending the parts request.' }
  }

  const contextResult = await loadEstimateContext(supabase, jobId)
  if (contextResult.error || !contextResult.context) {
    return { error: contextResult.error ?? 'Parts context could not be loaded.' }
  }

  const context = contextResult.context
  const result = await savePartsRequestSnapshot(supabase, user.id, context, input)
  if (result.error || !result.normalizedLines || !result.requestId) return { error: result.error ?? 'Parts request could not be saved.' }
  const normalizedLines = result.normalizedLines

  const emailResult = await sendVendorEmail({
    to: input.vendorEmail,
    subject: result.emailSubject ?? buildDefaultVendorEmailSubject(context),
    html: buildVendorEmailHtml(result.emailBody ?? buildDefaultVendorEmailBody(context, normalizedLines)),
  })

  if (emailResult.error) return { error: emailResult.error }

  const { error: requestError } = await supabase
    .from('job_parts_requests')
    .update({
      vendor_email_sent_at: new Date().toISOString(),
      vendor_email_sent_by: user.id,
      email_subject: result.emailSubject ?? buildDefaultVendorEmailSubject(context),
      email_body: result.emailBody ?? buildDefaultVendorEmailBody(context, normalizedLines),
    })
    .eq('id', result.requestId)

  if (requestError) return { error: requestError.message }

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      resolution_type: 'parts_sourcing',
      job_status: 'follow_up_planning',
      commercial_state: 'parts_needed',
      needs_admin_review: false,
    })
    .eq('id', jobId)

  if (jobError) return { error: jobError.message }

  revalidateEstimatePaths(jobId)
  return { success: true }
}

export async function markPartsOrdered(jobId: string, input: PartsDraftInput) {
  const { supabase, user, error: authError } = await requireEstimateManager()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  const contextResult = await loadEstimateContext(supabase, jobId)
  if (contextResult.error || !contextResult.context) {
    return { error: contextResult.error ?? 'Parts context could not be loaded.' }
  }

  const result = await savePartsRequestSnapshot(supabase, user.id, contextResult.context, input, {
    markOrdered: true,
  })
  if (result.error) return { error: result.error }

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      resolution_type: 'parts_sourcing',
      job_status: 'follow_up_planning',
      commercial_state: 'parts_ordered',
      needs_admin_review: false,
    })
    .eq('id', jobId)

  if (jobError) return { error: jobError.message }

  revalidateEstimatePaths(jobId)
  return { success: true }
}

export async function markReadyToSchedule(jobId: string, input: PartsDraftInput) {
  const { supabase, user, error: authError } = await requireEstimateManager()
  if (authError || !user) return { error: authError ?? 'Not authenticated' }

  const contextResult = await loadEstimateContext(supabase, jobId)
  if (contextResult.error || !contextResult.context) {
    return { error: contextResult.error ?? 'Parts context could not be loaded.' }
  }

  const context = contextResult.context
  if (!context.partsRequest && context.job.commercial_state !== 'parts_ordered') {
    return { error: 'Create the parts request before marking this job ready to schedule.' }
  }

  const result = await savePartsRequestSnapshot(supabase, user.id, context, input, {
    markReadyToSchedule: true,
  })
  if (result.error) return { error: result.error }

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      resolution_type: 'parts_sourcing',
      job_status: 'follow_up_planning',
      commercial_state: 'ready_to_schedule',
      needs_admin_review: false,
    })
    .eq('id', jobId)

  if (jobError) return { error: jobError.message }

  revalidateEstimatePaths(jobId)
  return { success: true }
}

export async function scheduleFollowUp(jobId: string, input: FollowUpScheduleInput) {
  const { supabase, error: authError } = await requireEstimateManager()
  if (authError) return { error: authError }

  const scheduledDate = input.scheduledDate.trim()
  const assignedTechId = input.assignedTechId.trim()
  const assistTechIds = normalizeAssistTechIds(input.assistTechIds, assignedTechId)

  if (!scheduledDate) {
    return { error: 'Choose the follow-up date before scheduling the revisit.' }
  }

  if (!assignedTechId) {
    return { error: 'Choose a lead tech before scheduling the follow-up.' }
  }

  const contextResult = await loadEstimateContext(supabase, jobId)
  if (contextResult.error || !contextResult.context) {
    return { error: contextResult.error ?? 'Follow-up scheduling context could not be loaded.' }
  }

  const context = contextResult.context
  if (context.job.commercial_state !== 'ready_to_schedule') {
    return { error: 'Move the job to ready to schedule before booking the follow-up visit.' }
  }

  const queueResult = await nextQueuePositionForTechDate(supabase, assignedTechId, scheduledDate)
  if (queueResult.error) return { error: queueResult.error }

  const jobStatus = 'follow_up_scheduled'
  const commercialState = 'none'
  const resolutionType = context.job.diagnosis_id ? 'standard_repair' : 'adhoc_repair'

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      assigned_tech: assignedTechId,
      actual_tech: null,
      job_date: scheduledDate,
      queue_position: queueResult.queuePosition,
      job_status: jobStatus,
      resolution_type: resolutionType,
      commercial_state: commercialState,
      status: getLegacyStatusFromLifecycle(jobStatus, commercialState, resolutionType),
      arrived_at: null,
      completed_at: null,
      needs_admin_review: false,
    })
    .eq('id', jobId)

  if (jobError) return { error: jobError.message }

  const assistError = await syncPlanningAssistTechs(supabase, jobId, assistTechIds)
  if (assistError) return { error: assistError }

  revalidateEstimatePaths(jobId)
  return { success: true }
}
