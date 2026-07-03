'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { JobCommercialState, JobResolutionType, JobStatus, getLegacyStatusFromLifecycle } from '@/utils/job-lifecycle'

type VisitStatus = 'scheduled' | 'en_route' | 'on_site'
type CompleteOutcome = 'repair_completed' | 'closed_no_action'

function readText(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim()
  return value ? value : null
}

function redirectToVisitError(visitId: string, message: string): never {
  redirect(`/visits/${visitId}?error=${encodeURIComponent(message)}`)
}

function redirectToTodayError(message: string): never {
  redirect(`/today?error=${encodeURIComponent(message)}`)
}

function statusToJobStatus(status: VisitStatus): JobStatus {
  if (status === 'en_route') return 'dispatched'
  if (status === 'on_site') return 'on_site'
  return 'scheduled'
}

function revalidateVisitPaths(visitId: string, jobId?: string | null) {
  revalidatePath('/')
  revalidatePath('/today')
  revalidatePath('/quick-update')
  revalidatePath(`/visits/${visitId}`)
  revalidatePath('/planning')
  revalidatePath('/jobs')
  if (jobId) revalidatePath(`/jobs/${jobId}`)
}

async function loadVisitForUpdate(supabase: Awaited<ReturnType<typeof createClient>>, visitId: string) {
  const { data: visit, error } = await supabase
    .from('service_visits')
    .select('id, service_request_id, legacy_job_id, status, billing_status, outcome, return_for_visit_id')
    .eq('id', visitId)
    .single()

  return { visit, error }
}

export async function updateVisitStatus(visitId: string, status: VisitStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { visit, error } = await loadVisitForUpdate(supabase, visitId)
  if (error || !visit) redirectToTodayError(error?.message ?? 'Visit not found.')

  const now = new Date().toISOString()
  const visitUpdate: Record<string, string> = { status }
  if (status === 'en_route') visitUpdate.departed_at = now
  if (status === 'on_site') visitUpdate.arrived_at = now

  const { error: visitUpdateError } = await supabase
    .from('service_visits')
    .update(visitUpdate)
    .eq('id', visit.id)

  if (visitUpdateError) redirectToVisitError(visit.id, visitUpdateError.message)

  if (visit.legacy_job_id) {
    const { data: job } = await supabase
      .from('jobs')
      .select('commercial_state, resolution_type, departed_at, arrived_at')
      .eq('id', visit.legacy_job_id)
      .maybeSingle()

    const jobStatus = statusToJobStatus(status)
    const commercialState = (job?.commercial_state ?? 'none') as JobCommercialState
    const resolutionType = (job?.resolution_type ?? null) as JobResolutionType | null
    const jobUpdate: Record<string, string> = {
      job_status: jobStatus,
      status: getLegacyStatusFromLifecycle(jobStatus, commercialState, resolutionType),
    }
    if (status === 'en_route' && !job?.departed_at) jobUpdate.departed_at = now
    if (status === 'on_site' && !job?.arrived_at) jobUpdate.arrived_at = now

    const { error: jobError } = await supabase
      .from('jobs')
      .update(jobUpdate)
      .eq('id', visit.legacy_job_id)

    if (jobError) redirectToVisitError(visit.id, jobError.message)

    if (status === 'en_route' || status === 'on_site') {
      await supabase.from('job_events').insert({
        job_id: visit.legacy_job_id,
        user_id: user.id,
        event_type: status === 'on_site' ? 'arrived' : 'departed',
      })
    }
  }

  revalidateVisitPaths(visit.id, visit.legacy_job_id)
}

export async function saveVisitNote(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const visitId = readText(formData, 'visit_id')
  const body = readText(formData, 'body')
  const accessNotes = readText(formData, 'access_notes')
  const accessConfirmed = readText(formData, 'access_confirmed')

  if (!visitId) redirectToTodayError('Visit is required.')
  if (!body && !accessNotes && !accessConfirmed) redirectToVisitError(visitId, 'Add a note or access update.')

  const { visit, error } = await loadVisitForUpdate(supabase, visitId)
  if (error || !visit) redirectToVisitError(visitId, error?.message ?? 'Visit not found.')

  const noteParts = [
    body,
    accessNotes ? `Access: ${accessNotes}` : null,
    accessConfirmed === 'confirmed' ? 'Access confirmed' : null,
    accessConfirmed === 'not_confirmed' ? 'Access not confirmed' : null,
  ].filter(Boolean)

  const { error: noteError } = await supabase
    .from('visit_notes')
    .insert({
      service_visit_id: visit.id,
      user_id: user.id,
      note_type: accessNotes || accessConfirmed ? 'access' : 'general',
      body: noteParts.join('\n'),
    })

  if (noteError) redirectToVisitError(visit.id, noteError.message)

  if (accessNotes) {
    const { error: requestError } = await supabase
      .from('service_requests')
      .update({ access_notes: accessNotes })
      .eq('id', visit.service_request_id)

    if (requestError) redirectToVisitError(visit.id, requestError.message)
  }

  const accessConfirmedValue =
    accessConfirmed === 'confirmed'
      ? true
      : accessConfirmed === 'not_confirmed'
        ? false
        : null

  if (accessConfirmedValue !== null) {
    const accessUpdate = {
      access_confirmed: accessConfirmedValue,
      access_confirmation_needed: !accessConfirmedValue,
    }

    const { error: visitAccessError } = await supabase
      .from('service_visits')
      .update(accessUpdate)
      .eq('id', visit.id)

    if (visitAccessError) redirectToVisitError(visit.id, visitAccessError.message)

    if (visit.legacy_job_id) {
      const { error: jobAccessError } = await supabase
        .from('jobs')
        .update(accessUpdate)
        .eq('id', visit.legacy_job_id)

      if (jobAccessError) redirectToVisitError(visit.id, jobAccessError.message)
    }
  }

  if (visit.legacy_job_id) {
    const { error: messageError } = await supabase
      .from('job_messages')
      .insert({
        job_id: visit.legacy_job_id,
        user_id: user.id,
        message_type: 'text',
        body: noteParts.join('\n'),
      })

    if (messageError) redirectToVisitError(visit.id, messageError.message)
  }

  revalidateVisitPaths(visit.id, visit.legacy_job_id)
}

export async function selectVisitRepair(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const visitId = readText(formData, 'visit_id')
  const bundleId = readText(formData, 'repair_bundle_id')
  if (!visitId) redirectToTodayError('Visit is required.')
  if (!bundleId) redirectToVisitError(visitId, 'Choose a repair.')

  const { visit, error } = await loadVisitForUpdate(supabase, visitId)
  if (error || !visit) redirectToVisitError(visitId, error?.message ?? 'Visit not found.')

  const { data: bundle, error: bundleError } = await supabase
    .from('repair_bundles')
    .select(`
      id,
      diagnosis_id,
      name,
      flat_rate,
      variable_pricing,
      notes,
      pricing_notes,
      travel_time_hours,
      work_time_hours,
      total_time_hours,
      labor_cost,
      part_material_cost,
      profit_amount,
      margin_percent,
      diagnoses!repair_bundles_diagnosis_id_fkey(repair_code, invoice_description, repair_notes)
    `)
    .eq('id', bundleId)
    .single()

  if (bundleError || !bundle) redirectToVisitError(visit.id, bundleError?.message ?? 'Repair not found.')

  const diagnosis = Array.isArray(bundle.diagnoses) ? bundle.diagnoses[0] : bundle.diagnoses
  const templateSnapshot = {
    repair_bundle_id: bundle.id,
    diagnosis_id: bundle.diagnosis_id,
    name: bundle.name,
    flat_rate: bundle.flat_rate,
    variable_pricing: bundle.variable_pricing,
    notes: bundle.notes,
    pricing_notes: bundle.pricing_notes,
    travel_time_hours: bundle.travel_time_hours,
    work_time_hours: bundle.work_time_hours,
    total_time_hours: bundle.total_time_hours,
    labor_cost: bundle.labor_cost,
    part_material_cost: bundle.part_material_cost,
    profit_amount: bundle.profit_amount,
    margin_percent: bundle.margin_percent,
    repair_code: diagnosis?.repair_code ?? null,
    invoice_description: diagnosis?.invoice_description ?? null,
    repair_notes: diagnosis?.repair_notes ?? null,
  }

  const { error: repairError } = await supabase
    .from('visit_repairs')
    .insert({
      service_visit_id: visit.id,
      repair_bundle_id: bundle.id,
      source: 'catalog',
      quantity: 1,
      repair_code: diagnosis?.repair_code ?? bundle.name,
      description_title: bundle.name,
      description_body: diagnosis?.repair_notes ?? bundle.notes ?? null,
      customer_description: diagnosis?.invoice_description ?? bundle.name,
      flat_rate_amount: bundle.flat_rate ?? null,
      variable_pricing: Boolean(bundle.variable_pricing),
      template_snapshot: templateSnapshot,
      selected_by: user.id,
    })

  if (repairError) redirectToVisitError(visit.id, repairError.message)

  if (visit.legacy_job_id && bundle.diagnosis_id) {
    await supabase
      .from('jobs')
      .update({
        diagnosis_id: bundle.diagnosis_id,
        new_diagnosis_requested: false,
      })
      .eq('id', visit.legacy_job_id)
  }

  revalidateVisitPaths(visit.id, visit.legacy_job_id)
}

export async function markVisitPartsNeeded(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const visitId = readText(formData, 'visit_id')
  const partName = readText(formData, 'part_name')
  const partNumber = readText(formData, 'part_number')
  const notes = readText(formData, 'notes')
  const quantityText = readText(formData, 'quantity')
  const quantity = quantityText ? Number(quantityText) : 1

  if (!visitId) redirectToTodayError('Visit is required.')
  if (!partName) redirectToVisitError(visitId, 'Part name is required.')
  if (!Number.isFinite(quantity) || quantity <= 0) redirectToVisitError(visitId, 'Quantity must be greater than zero.')

  const { visit, error } = await loadVisitForUpdate(supabase, visitId)
  if (error || !visit) redirectToVisitError(visitId, error?.message ?? 'Visit not found.')

  const { error: partError } = await supabase
    .from('visit_parts_needed')
    .insert({
      service_visit_id: visit.id,
      part_name: partName,
      part_number: partNumber,
      quantity,
      notes,
      return_visit_required: true,
      created_by: user.id,
    })

  if (partError) redirectToVisitError(visit.id, partError.message)

  const { error: visitError } = await supabase
    .from('service_visits')
    .update({
      status: 'completed',
      outcome: 'parts_needed',
      billing_status: 'blocked_parts_return',
      needs_return_visit: true,
      no_invoice_until_return_complete: true,
      completed_at: new Date().toISOString(),
      actual_tech: user.id,
    })
    .eq('id', visit.id)

  if (visitError) redirectToVisitError(visit.id, visitError.message)

  await supabase
    .from('service_requests')
    .update({ status: 'waiting_parts' })
    .eq('id', visit.service_request_id)

  if (visit.legacy_job_id) {
    const jobStatus: JobStatus = 'follow_up_planning'
    const commercialState: JobCommercialState = 'parts_needed'
    const resolutionType: JobResolutionType = 'parts_sourcing'

    await supabase
      .from('jobs')
      .update({
        job_status: jobStatus,
        resolution_type: resolutionType,
        commercial_state: commercialState,
        status: getLegacyStatusFromLifecycle(jobStatus, commercialState, resolutionType),
        completed_at: new Date().toISOString(),
        actual_tech: user.id,
      })
      .eq('id', visit.legacy_job_id)

    await supabase.from('job_messages').insert({
      job_id: visit.legacy_job_id,
      user_id: user.id,
      message_type: 'text',
      body: `Parts needed: ${partName}${partNumber ? ` (${partNumber})` : ''}${notes ? `\n${notes}` : ''}`,
    })
  }

  revalidateVisitPaths(visit.id, visit.legacy_job_id)
}

export async function completeVisit(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const visitId = readText(formData, 'visit_id')
  const outcome = (readText(formData, 'outcome') ?? 'repair_completed') as CompleteOutcome
  if (!visitId) redirectToTodayError('Visit is required.')

  const { visit, error } = await loadVisitForUpdate(supabase, visitId)
  if (error || !visit) redirectToVisitError(visitId, error?.message ?? 'Visit not found.')

  const { count: repairCount, error: repairCountError } = await supabase
    .from('visit_repairs')
    .select('id', { count: 'exact', head: true })
    .eq('service_visit_id', visit.id)

  if (repairCountError) redirectToVisitError(visit.id, repairCountError.message)
  if (outcome === 'repair_completed' && (repairCount ?? 0) === 0) {
    redirectToVisitError(visit.id, 'Select at least one repair before completing to invoice-ready.')
  }

  const completedAt = new Date().toISOString()
  const billingStatus = outcome === 'closed_no_action' ? 'not_billable' : 'ready_for_invoice'

  const { error: visitError } = await supabase
    .from('service_visits')
    .update({
      status: 'completed',
      outcome,
      billing_status: billingStatus,
      completed_at: completedAt,
      actual_tech: user.id,
    })
    .eq('id', visit.id)

  if (visitError) redirectToVisitError(visit.id, visitError.message)

  await supabase
    .from('service_requests')
    .update({ status: 'completed' })
    .eq('id', visit.service_request_id)

  if (visit.legacy_job_id) {
    const jobStatus: JobStatus = 'completed'
    const commercialState: JobCommercialState = outcome === 'closed_no_action' ? 'none' : 'ready_for_invoice'
    const resolutionType: JobResolutionType = outcome === 'closed_no_action' ? 'closed_no_action' : 'standard_repair'

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        job_status: jobStatus,
        resolution_type: resolutionType,
        commercial_state: commercialState,
        status: getLegacyStatusFromLifecycle(jobStatus, commercialState, resolutionType),
        completed_at: completedAt,
        needs_admin_review: outcome !== 'closed_no_action',
        actual_tech: user.id,
      })
      .eq('id', visit.legacy_job_id)

    if (jobError) redirectToVisitError(visit.id, jobError.message)

    await supabase.from('job_events').insert({
      job_id: visit.legacy_job_id,
      user_id: user.id,
      event_type: 'completed',
    })
  }

  revalidateVisitPaths(visit.id, visit.legacy_job_id)
  redirect('/today')
}

export async function addUnitFromVisit(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const originVisitId = readText(formData, 'origin_visit_id')
  const unit = readText(formData, 'unit')
  const problemDescription = readText(formData, 'problem_description')
  const assignedTech = readText(formData, 'assigned_tech')
  if (!originVisitId || !unit || !problemDescription) {
    if (originVisitId) redirectToVisitError(originVisitId, 'Unit and issue are required.')
    redirectToTodayError('Unit and issue are required.')
  }

  const { data: originVisit, error } = await supabase
    .from('service_visits')
    .select(`
      id,
      service_request_id,
      legacy_job_id,
      service_requests!service_visits_service_request_id_fkey(customer_id, location_id)
    `)
    .eq('id', originVisitId)
    .single()

  if (error || !originVisit) redirectToVisitError(originVisitId, error?.message ?? 'Origin visit not found.')

  const originRequest = Array.isArray(originVisit.service_requests)
    ? originVisit.service_requests[0]
    : originVisit.service_requests
  if (!originRequest) redirectToVisitError(originVisitId, 'Origin request not found.')

  const today = new Date().toISOString().split('T')[0]
  const { data: latestQueue } = assignedTech
    ? await supabase
        .from('jobs')
        .select('queue_position')
        .eq('assigned_tech', assignedTech)
        .eq('job_date', today)
        .order('queue_position', { ascending: false })
        .limit(1)
    : { data: null }
  const queuePosition = latestQueue?.[0]?.queue_position ? latestQueue[0].queue_position + 1 : assignedTech ? 1 : null
  const jobStatus: JobStatus = assignedTech ? 'scheduled' : 'intake'

  const { data: insertedJob, error: jobError } = await supabase
    .from('jobs')
    .insert({
      customer_id: originRequest.customer_id,
      location_id: originRequest.location_id,
      manual_unit: unit,
      priority: 'routine',
      workflow_type: 'standard',
      job_status: jobStatus,
      commercial_state: 'none',
      assigned_tech: assignedTech,
      problem_description: problemDescription,
      status: getLegacyStatusFromLifecycle(jobStatus, 'none', null),
      how_it_came_in: 'tech_direct',
      job_date: today,
      queue_position: queuePosition,
    })
    .select('id')
    .single()

  if (jobError || !insertedJob) redirectToVisitError(originVisit.id, jobError?.message ?? 'Job was not created.')

  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      created_from_legacy_job_id: insertedJob.id,
      origin_visit_id: originVisit.id,
      parent_request_id: originVisit.service_request_id,
      request_kind: 'add_unit',
      billable: true,
      customer_id: originRequest.customer_id,
      location_id: originRequest.location_id,
      source: 'onsite',
      status: assignedTech ? 'scheduled' : 'intake',
      priority: 'routine',
      problem_description: problemDescription,
      manual_unit: unit,
      requested_by: user.id,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (requestError || !request) {
    await supabase.from('jobs').delete().eq('id', insertedJob.id)
    redirectToVisitError(originVisit.id, requestError?.message ?? 'Service request was not created.')
  }

  const { data: visit, error: visitError } = await supabase
    .from('service_visits')
    .insert({
      service_request_id: request.id,
      legacy_job_id: insertedJob.id,
      visit_sequence: 1,
      is_initial_visit: true,
      billable: true,
      assigned_tech: assignedTech,
      scheduled_date: today,
      queue_position: queuePosition,
      status: 'scheduled',
      billing_status: 'not_ready',
    })
    .select('id')
    .single()

  if (visitError || !visit) {
    await supabase.from('service_requests').delete().eq('id', request.id)
    await supabase.from('jobs').delete().eq('id', insertedJob.id)
    redirectToVisitError(originVisit.id, visitError?.message ?? 'Service visit was not created.')
  }

  revalidateVisitPaths(originVisit.id, originVisit.legacy_job_id)
  revalidatePath(`/visits/${visit.id}`)
  redirect(`/visits/${visit.id}`)
}
