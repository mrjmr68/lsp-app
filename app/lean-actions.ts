'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { JobCommercialState, JobResolutionType, JobStatus, getLegacyStatusFromLifecycle } from '@/utils/job-lifecycle'

function text(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim()
  return value ? value : null
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

async function loadVisit(supabase: Awaited<ReturnType<typeof createClient>>, visitId: string) {
  const { data: visit, error } = await supabase
    .from('service_visits')
    .select('id, service_request_id, legacy_job_id, assigned_tech')
    .eq('id', visitId)
    .single()

  if (error || !visit) redirect(`/?error=${encodeURIComponent(error?.message ?? 'Visit not found.')}`)
  return visit
}

function jobStatusForVisitStatus(status: 'en_route' | 'on_site'): JobStatus {
  return status === 'on_site' ? 'on_site' : 'dispatched'
}

async function setVisitStatus(visitId: string, status: 'en_route' | 'on_site') {
  const { supabase, user } = await requireUser()
  const visit = await loadVisit(supabase, visitId)
  const now = new Date().toISOString()

  const { error: visitError } = await supabase
    .from('service_visits')
    .update({
      status,
      ...(status === 'en_route' ? { departed_at: now } : { arrived_at: now }),
    })
    .eq('id', visitId)

  if (visitError) redirect(`/visits/${visitId}/transit?error=${encodeURIComponent(visitError.message)}`)

  await supabase
    .from('service_requests')
    .update({ status: 'active' })
    .eq('id', visit.service_request_id)

  if (visit.legacy_job_id) {
    const { data: job } = await supabase
      .from('jobs')
      .select('commercial_state, resolution_type')
      .eq('id', visit.legacy_job_id)
      .maybeSingle()

    const jobStatus = jobStatusForVisitStatus(status)
    const commercialState = (job?.commercial_state ?? 'none') as JobCommercialState
    const resolutionType = (job?.resolution_type ?? null) as JobResolutionType | null

    await supabase
      .from('jobs')
      .update({
        job_status: jobStatus,
        status: getLegacyStatusFromLifecycle(jobStatus, commercialState, resolutionType),
        ...(status === 'en_route' ? { departed_at: now } : { arrived_at: now }),
      })
      .eq('id', visit.legacy_job_id)

    await supabase.from('job_events').insert({
      job_id: visit.legacy_job_id,
      user_id: user.id,
      event_type: status === 'on_site' ? 'arrived' : 'departed',
    })
  }

  revalidatePath('/')
  revalidatePath(`/visits/${visitId}/transit`)
  revalidatePath(`/visits/${visitId}/diagnose`)
}

export async function startTransit(visitId: string) {
  await setVisitStatus(visitId, 'en_route')
  redirect(`/visits/${visitId}/transit`)
}

export async function arriveOnSite(visitId: string) {
  await setVisitStatus(visitId, 'on_site')
  redirect(`/visits/${visitId}/diagnose`)
}

export async function saveDiagnosisNote(formData: FormData) {
  const visitId = text(formData, 'visit_id')
  const body = text(formData, 'body')
  if (!visitId) redirect('/?error=Missing visit.')
  if (!body) redirect(`/visits/${visitId}/diagnose?error=${encodeURIComponent('Add a note before continuing.')}`)

  const { supabase, user } = await requireUser()
  const visit = await loadVisit(supabase, visitId)

  const { error } = await supabase.from('visit_notes').insert({
    service_visit_id: visitId,
    user_id: user.id,
    note_type: 'general',
    body,
  })

  if (error) redirect(`/visits/${visitId}/diagnose?error=${encodeURIComponent(error.message)}`)

  if (visit.legacy_job_id) {
    await supabase.from('job_messages').insert({
      job_id: visit.legacy_job_id,
      user_id: user.id,
      message_type: 'text',
      body,
    })
  }

  revalidatePath(`/visits/${visitId}/diagnose`)
  redirect(`/visits/${visitId}/resolve`)
}

export async function createFastIntake(formData: FormData) {
  const { supabase, user } = await requireUser()
  const customerName = text(formData, 'customer_name')
  const address = text(formData, 'address')
  const phone = text(formData, 'phone')
  const problem = text(formData, 'problem_description')
  const assignedTech = text(formData, 'assigned_tech')
  const intent = text(formData, 'intent')

  if (!customerName || !address || !problem) {
    redirect(`/intake?error=${encodeURIComponent('Customer, address, and problem are required.')}`)
  }
  if (intent === 'assign_now' && !assignedTech) {
    redirect(`/intake?error=${encodeURIComponent('Choose a crew member or save for later.')}`)
  }

  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .ilike('name', customerName)
    .limit(1)
    .maybeSingle()

  let customerId = existingCustomer?.id ?? null
  if (!customerId) {
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        name: customerName,
        type: 'residential',
        billing_address: address,
        billing_phone: phone,
      })
      .select('id')
      .single()

    if (error || !customer) redirect(`/intake?error=${encodeURIComponent(error?.message ?? 'Customer was not created.')}`)
    customerId = customer.id
  }

  const { data: existingLocation } = await supabase
    .from('locations')
    .select('id')
    .eq('customer_id', customerId)
    .ilike('street_address', address)
    .limit(1)
    .maybeSingle()

  let locationId = existingLocation?.id ?? null
  if (!locationId) {
    const { data: location, error } = await supabase
      .from('locations')
      .insert({
        customer_id: customerId,
        name: address,
        street_address: address,
      })
      .select('id')
      .single()

    if (error || !location) redirect(`/intake?error=${encodeURIComponent(error?.message ?? 'Location was not created.')}`)
    locationId = location.id
  }

  const today = new Date().toISOString().split('T')[0]
  const jobStatus: JobStatus = assignedTech ? 'scheduled' : 'intake'
  const { data: insertedJob, error: jobError } = await supabase
    .from('jobs')
    .insert({
      customer_id: customerId,
      location_id: locationId,
      priority: 'routine',
      workflow_type: 'standard',
      job_status: jobStatus,
      commercial_state: 'none',
      assigned_tech: assignedTech,
      problem_description: problem,
      status: getLegacyStatusFromLifecycle(jobStatus, 'none', null),
      how_it_came_in: 'phone',
      job_date: today,
    })
    .select('id')
    .single()

  if (jobError || !insertedJob) redirect(`/intake?error=${encodeURIComponent(jobError?.message ?? 'Job was not created.')}`)

  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      created_from_legacy_job_id: insertedJob.id,
      request_kind: 'service_call',
      billable: true,
      customer_id: customerId,
      location_id: locationId,
      source: 'phone',
      status: assignedTech ? 'scheduled' : 'intake',
      priority: 'routine',
      problem_description: problem,
      requested_by: user.id,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (requestError || !request) {
    await supabase.from('jobs').delete().eq('id', insertedJob.id)
    redirect(`/intake?error=${encodeURIComponent(requestError?.message ?? 'Request was not created.')}`)
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
      status: 'scheduled',
      billing_status: 'not_ready',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (visitError || !visit) {
    await supabase.from('service_requests').delete().eq('id', request.id)
    await supabase.from('jobs').delete().eq('id', insertedJob.id)
    redirect(`/intake?error=${encodeURIComponent(visitError?.message ?? 'Visit was not created.')}`)
  }

  revalidatePath('/')
  redirect('/')
}

export async function selectLeanRepair(formData: FormData) {
  const visitId = text(formData, 'visit_id')
  const bundleId = text(formData, 'repair_bundle_id')
  if (!visitId) redirect('/?error=Missing visit.')
  if (!bundleId) redirect(`/visits/${visitId}/resolve?error=${encodeURIComponent('Choose a repair.')}`)

  const { supabase, user } = await requireUser()
  const visit = await loadVisit(supabase, visitId)
  const { data: bundle, error: bundleError } = await supabase
    .from('repair_bundles')
    .select(`
      id, diagnosis_id, name, flat_rate, variable_pricing, notes,
      diagnoses!repair_bundles_diagnosis_id_fkey(repair_code, invoice_description, repair_notes)
    `)
    .eq('id', bundleId)
    .single()

  if (bundleError || !bundle) redirect(`/visits/${visitId}/resolve?error=${encodeURIComponent(bundleError?.message ?? 'Repair not found.')}`)

  const diagnosis = Array.isArray(bundle.diagnoses) ? bundle.diagnoses[0] : bundle.diagnoses
  const { error } = await supabase.from('visit_repairs').insert({
    service_visit_id: visitId,
    repair_bundle_id: bundle.id,
    source: 'catalog',
    quantity: 1,
    repair_code: diagnosis?.repair_code ?? bundle.name,
    description_title: bundle.name,
    description_body: diagnosis?.repair_notes ?? bundle.notes ?? null,
    customer_description: diagnosis?.invoice_description ?? bundle.name,
    flat_rate_amount: bundle.flat_rate ?? null,
    variable_pricing: Boolean(bundle.variable_pricing),
    template_snapshot: {
      repair_bundle_id: bundle.id,
      diagnosis_id: bundle.diagnosis_id,
      name: bundle.name,
      flat_rate: bundle.flat_rate,
      variable_pricing: bundle.variable_pricing,
      repair_code: diagnosis?.repair_code ?? null,
      invoice_description: diagnosis?.invoice_description ?? null,
    },
    selected_by: user.id,
  })

  if (error) redirect(`/visits/${visitId}/resolve?error=${encodeURIComponent(error.message)}`)

  if (visit.legacy_job_id && bundle.diagnosis_id) {
    await supabase.from('jobs').update({ diagnosis_id: bundle.diagnosis_id }).eq('id', visit.legacy_job_id)
  }

  revalidatePath(`/visits/${visitId}/resolve`)
  redirect(`/visits/${visitId}/resolve`)
}

export async function closeNoAction(visitId: string) {
  const { supabase, user } = await requireUser()
  const visit = await loadVisit(supabase, visitId)
  const completedAt = new Date().toISOString()

  await supabase
    .from('service_visits')
    .update({
      status: 'completed',
      outcome: 'closed_no_action',
      billing_status: 'not_billable',
      completed_at: completedAt,
      actual_tech: user.id,
    })
    .eq('id', visitId)

  await supabase.from('service_requests').update({ status: 'completed' }).eq('id', visit.service_request_id)

  if (visit.legacy_job_id) {
    await supabase
      .from('jobs')
      .update({
        job_status: 'completed',
        resolution_type: 'closed_no_action',
        commercial_state: 'none',
        status: getLegacyStatusFromLifecycle('completed', 'none', 'closed_no_action'),
        completed_at: completedAt,
        actual_tech: user.id,
        needs_admin_review: false,
      })
      .eq('id', visit.legacy_job_id)
  }

  revalidatePath('/')
  redirect('/')
}

export async function completeRepairVisit(visitId: string) {
  const { supabase, user } = await requireUser()
  const visit = await loadVisit(supabase, visitId)
  const { count } = await supabase
    .from('visit_repairs')
    .select('id', { count: 'exact', head: true })
    .eq('service_visit_id', visitId)

  if ((count ?? 0) === 0) redirect(`/visits/${visitId}/resolve?error=${encodeURIComponent('Select at least one repair first.')}`)

  const completedAt = new Date().toISOString()
  await supabase
    .from('service_visits')
    .update({
      status: 'completed',
      outcome: 'repair_completed',
      billing_status: 'ready_for_invoice',
      completed_at: completedAt,
      actual_tech: user.id,
    })
    .eq('id', visitId)

  await supabase.from('service_requests').update({ status: 'completed' }).eq('id', visit.service_request_id)

  if (visit.legacy_job_id) {
    await supabase
      .from('jobs')
      .update({
        job_status: 'completed',
        resolution_type: 'standard_repair',
        commercial_state: 'ready_for_invoice',
        status: getLegacyStatusFromLifecycle('completed', 'ready_for_invoice', 'standard_repair'),
        completed_at: completedAt,
        actual_tech: user.id,
        needs_admin_review: true,
      })
      .eq('id', visit.legacy_job_id)
  }

  revalidatePath('/')
  revalidatePath('/invoices')
  redirect('/')
}

export async function markLeanPartsNeeded(formData: FormData) {
  const visitId = text(formData, 'visit_id')
  const partName = text(formData, 'part_name')
  const quantityText = text(formData, 'quantity')
  const notes = text(formData, 'notes')
  if (!visitId) redirect('/?error=Missing visit.')
  if (!partName) redirect(`/visits/${visitId}/parts?error=${encodeURIComponent('Part name is required.')}`)

  const { supabase, user } = await requireUser()
  const visit = await loadVisit(supabase, visitId)
  const quantity = quantityText ? Number(quantityText) : 1

  await supabase.from('visit_parts_needed').insert({
    service_visit_id: visitId,
    part_name: partName,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    notes,
    return_visit_required: true,
    created_by: user.id,
  })

  await supabase
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
    .eq('id', visitId)

  await supabase.from('service_requests').update({ status: 'waiting_parts' }).eq('id', visit.service_request_id)

  if (visit.legacy_job_id) {
    await supabase
      .from('jobs')
      .update({
        job_status: 'follow_up_planning',
        resolution_type: 'parts_sourcing',
        commercial_state: 'parts_needed',
        status: getLegacyStatusFromLifecycle('follow_up_planning', 'parts_needed', 'parts_sourcing'),
      })
      .eq('id', visit.legacy_job_id)
  }

  revalidatePath('/')
  redirect('/')
}
