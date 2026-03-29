'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addJob(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const customerId = formData.get('customer_id') as string
  const locationId = formData.get('location_id') as string
  const unit = formData.get('unit') as string
  const priority = formData.get('priority') as string
  const assignedTech = formData.get('assigned_tech') as string
  const problemDesc = formData.get('problem_description') as string
  const accessNeeded = formData.get('access_confirmation_needed') === 'true'

  if (!customerId || !locationId) {
    return { error: 'Customer and location are required' }
  }

  const today = new Date().toISOString().split('T')[0]

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

  const { error } = await supabase.from('jobs').insert({
    customer_id: customerId,
    location_id: locationId,
    manual_unit: unit || null,
    priority: priority || 'routine',
    assigned_tech: assignedTech || null,
    problem_description: problemDesc || null,
    access_confirmation_needed: accessNeeded,
    status: assignedTech ? 'assigned' : 'new',
    how_it_came_in: 'dispatcher',
    job_date: today,
    queue_position: queuePosition,
  })

  if (error) {
    console.error('Insert job error:', error.message, error.details, error.hint)
    return { error: error.message }
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
