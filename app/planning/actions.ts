'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { JobStatus, getLegacyStatusFromLifecycle, getResolutionTypeForWorkflow } from '@/utils/job-lifecycle'

function parseAssistTechIds(formData: FormData) {
  return Array.from(new Set(
    formData
      .getAll('assist_tech_ids')
      .map(value => (typeof value === 'string' ? value : ''))
      .filter(Boolean)
  ))
}

async function syncPlanningAssistTechs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  assistTechIds: string[],
) {
  const { error } = await supabase.rpc('set_job_planning_assists', {
    p_job_id: jobId,
    p_assist_ids: assistTechIds,
  })

  if (error) {
    console.error('Assist crew sync error:', error.message, error.details, error.hint)
    return error.message
  }

  return null
}

export async function addJob(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const customerId = formData.get('customer_id') as string
  const locationId = formData.get('location_id') as string
  const unit = formData.get('unit') as string
  const priority = formData.get('priority') as string
  const workflowType = formData.get('workflow_type') as string
  const assignedTech = formData.get('assigned_tech') as string
  const assistTechIds = parseAssistTechIds(formData).filter(techId => techId !== assignedTech)
  const problemDesc = formData.get('problem_description') as string
  const accessNeeded = formData.get('access_confirmation_needed') === 'true'

  if (!customerId || !locationId) {
    return { error: 'Customer and location are required' }
  }
  if (assistTechIds.length > 0 && !assignedTech) {
    return { error: 'Assign a lead tech before adding assist techs.' }
  }

  const today = new Date().toISOString().split('T')[0]
  const resolutionType = getResolutionTypeForWorkflow(workflowType)
  const jobStatus: JobStatus = assignedTech ? 'scheduled' : 'intake'

  let queuePosition: number | null = null
  if (assignedTech) {
    const { data: existing } = await supabase
      .from('jobs')
      .select('queue_position')
      .eq('assigned_tech', assignedTech)
      .eq('job_date', today)
      .order('queue_position', { ascending: false })
      .limit(1)

    queuePosition = existing?.[0]?.queue_position
      ? existing[0].queue_position + 1
      : 1
  }

  const { data: insertedJob, error } = await supabase
    .from('jobs')
    .insert({
      customer_id: customerId,
      location_id: locationId,
      manual_unit: unit || null,
      priority: priority || 'routine',
      workflow_type: workflowType || 'standard',
      job_status: jobStatus,
      resolution_type: resolutionType,
      commercial_state: 'none',
      assigned_tech: assignedTech || null,
      problem_description: problemDesc || null,
      access_confirmation_needed: accessNeeded,
      status: getLegacyStatusFromLifecycle(jobStatus, 'none', resolutionType),
      how_it_came_in: 'dispatcher',
      job_date: today,
      queue_position: queuePosition,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Insert job error:', error.message, error.details, error.hint)
    return { error: error.message }
  }
  if (!insertedJob?.id) {
    return { error: 'Job was created but no id was returned.' }
  }

  if (assistTechIds.length > 0) {
    const assistError = await syncPlanningAssistTechs(supabase, insertedJob.id, assistTechIds)
    if (assistError) {
      await supabase
        .from('jobs')
        .delete()
        .eq('id', insertedJob.id)

      return { error: assistError }
    }
  }

  revalidatePath('/planning')
  return { success: true }
}

export async function assignJob(jobId: string, techId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('assign_job_planning', {
    p_job_id: jobId,
    p_tech_id: techId,
  })

  if (error) {
    console.error('Assign job error:', error.message, error.details, error.hint)
    return { error: error.message }
  }

  revalidatePath('/planning')
  return { success: true, data }
}

export async function updateAssistTechs(jobId: string, assistTechIds: string[]) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const normalizedAssistIds = Array.from(new Set(assistTechIds.filter(Boolean)))
  const assistError = await syncPlanningAssistTechs(supabase, jobId, normalizedAssistIds)
  if (assistError) return { error: assistError }

  revalidatePath('/planning')
  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
  return { success: true }
}

export async function toggleAccessConfirmed(jobId: string, confirmed: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('jobs')
    .update({ access_confirmed: confirmed })
    .eq('id', jobId)

  if (error) {
    console.error('Toggle access confirmed error:', error.message, error.details, error.hint)
    return { error: error.message }
  }

  revalidatePath('/planning')
  return { success: true }
}
