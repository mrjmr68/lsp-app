'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { JobCommercialState, JobResolutionType, JobStatus, getLegacyStatusFromLifecycle } from '@/utils/job-lifecycle'

type QuickVisitStatus = 'scheduled' | 'en_route' | 'on_site'

function readText(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim()
  return value ? value : null
}

function mapVisitStatusToJobStatus(status: QuickVisitStatus): JobStatus {
  if (status === 'en_route') return 'dispatched'
  if (status === 'on_site') return 'on_site'
  return 'scheduled'
}

function revalidateQuickUpdate(jobId?: string | null) {
  revalidatePath('/')
  revalidatePath('/today')
  revalidatePath('/quick-update')
  revalidatePath('/planning')
  revalidatePath('/jobs')
  if (jobId) revalidatePath(`/jobs/${jobId}`)
}

export async function quickUpdateVisit(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const visitId = readText(formData, 'service_visit_id')
  const noteType = readText(formData, 'note_type') ?? 'general'
  const noteBody = readText(formData, 'body')
  const accessNotes = readText(formData, 'access_notes')
  const statusUpdate = readText(formData, 'status_update') as QuickVisitStatus | null
  const accessConfirmedInput = readText(formData, 'access_confirmed')

  if (!visitId) return { error: 'Choose a visit to update.' }
  if (!noteBody && !accessNotes && !statusUpdate && !accessConfirmedInput) {
    return { error: 'Add a note, access detail, status change, or access confirmation.' }
  }

  const { data: visit, error: visitError } = await supabase
    .from('service_visits')
    .select('id, service_request_id, legacy_job_id, status, access_confirmed')
    .eq('id', visitId)
    .single()

  if (visitError || !visit) {
    return { error: visitError?.message ?? 'Visit not found.' }
  }

  const now = new Date().toISOString()
  const accessConfirmed =
    accessConfirmedInput === 'confirmed'
      ? true
      : accessConfirmedInput === 'not_confirmed'
        ? false
        : null

  const visitUpdate: Record<string, string | boolean | null> = {}
  if (statusUpdate) {
    visitUpdate.status = statusUpdate
    if (statusUpdate === 'en_route') visitUpdate.departed_at = now
    if (statusUpdate === 'on_site') visitUpdate.arrived_at = now
  }
  if (accessConfirmed !== null) {
    visitUpdate.access_confirmed = accessConfirmed
    visitUpdate.access_confirmation_needed = !accessConfirmed
  }

  if (Object.keys(visitUpdate).length > 0) {
    const { error: updateVisitError } = await supabase
      .from('service_visits')
      .update(visitUpdate)
      .eq('id', visit.id)

    if (updateVisitError) return { error: updateVisitError.message }
  }

  if (accessNotes) {
    const { error: requestError } = await supabase
      .from('service_requests')
      .update({ access_notes: accessNotes })
      .eq('id', visit.service_request_id)

    if (requestError) return { error: requestError.message }
  }

  const noteParts = [
    noteBody,
    accessNotes ? `Access: ${accessNotes}` : null,
    statusUpdate ? `Status: ${statusUpdate.replaceAll('_', ' ')}` : null,
    accessConfirmedInput === 'confirmed' ? 'Access confirmed' : null,
    accessConfirmedInput === 'not_confirmed' ? 'Access not confirmed' : null,
  ].filter(Boolean)

  if (noteParts.length > 0) {
    const { error: noteError } = await supabase
      .from('visit_notes')
      .insert({
        service_visit_id: visit.id,
        user_id: user.id,
        note_type: noteType,
        body: noteParts.join('\n'),
      })

    if (noteError) return { error: noteError.message }
  }

  if (visit.legacy_job_id) {
    const { data: job } = await supabase
      .from('jobs')
      .select('commercial_state, resolution_type, departed_at, arrived_at')
      .eq('id', visit.legacy_job_id)
      .maybeSingle()

    const jobUpdate: Record<string, string | boolean | null> = {}
    if (statusUpdate) {
      const jobStatus = mapVisitStatusToJobStatus(statusUpdate)
      const commercialState = (job?.commercial_state ?? 'none') as JobCommercialState
      const resolutionType = (job?.resolution_type ?? null) as JobResolutionType | null
      jobUpdate.job_status = jobStatus
      jobUpdate.status = getLegacyStatusFromLifecycle(jobStatus, commercialState, resolutionType)
      if (statusUpdate === 'en_route' && !job?.departed_at) jobUpdate.departed_at = now
      if (statusUpdate === 'on_site' && !job?.arrived_at) jobUpdate.arrived_at = now
    }
    if (accessConfirmed !== null) {
      jobUpdate.access_confirmed = accessConfirmed
      jobUpdate.access_confirmation_needed = !accessConfirmed
    }

    if (Object.keys(jobUpdate).length > 0) {
      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .update(jobUpdate)
        .eq('id', visit.legacy_job_id)

      if (jobUpdateError) return { error: jobUpdateError.message }
    }

    if (noteParts.length > 0) {
      const { error: messageError } = await supabase
        .from('job_messages')
        .insert({
          job_id: visit.legacy_job_id,
          user_id: user.id,
          message_type: 'text',
          body: noteParts.join('\n'),
        })

      if (messageError) return { error: messageError.message }
    }

    if (statusUpdate === 'en_route') {
      await supabase.from('job_events').insert({
        job_id: visit.legacy_job_id,
        user_id: user.id,
        event_type: 'departed',
      })
    }

    if (statusUpdate === 'on_site') {
      await supabase.from('job_events').insert({
        job_id: visit.legacy_job_id,
        user_id: user.id,
        event_type: 'arrived',
      })
    }
  }

  revalidateQuickUpdate(visit.legacy_job_id)
  return { success: true }
}
