'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

type AllowedRole = 'tech' | 'dispatcher' | 'admin' | 'owner'

const MANAGEABLE_ROLES: AllowedRole[] = ['tech', 'dispatcher', 'admin', 'owner']

async function requireAdminHubAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Not authenticated', role: null as string | null }

  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { supabase, error: error.message, role: null as string | null }
  if (!profile || !['admin', 'owner', 'dispatcher'].includes(profile.role)) {
    return { supabase, error: 'Admin access is limited to admin, owner, or dispatcher roles.', role: profile?.role ?? null }
  }

  return { supabase, error: null, role: profile.role }
}

export async function updateUserProfileAction(data: {
  userId: string
  firstName: string
  lastName: string
  phone: string
  role: AllowedRole
  active: boolean
}) {
  const { supabase, error, role: currentRole } = await requireAdminHubAccess()
  if (error) return { success: false, error }

  if (!MANAGEABLE_ROLES.includes(data.role)) {
    return { success: false, error: 'Invalid role.' }
  }

  if (currentRole === 'dispatcher' && data.role !== 'tech' && data.role !== 'dispatcher') {
    return { success: false, error: 'Dispatchers can only set tech or dispatcher roles.' }
  }

  const firstName = data.firstName.trim()
  const lastName = data.lastName.trim()
  const phone = data.phone.trim()

  if (!firstName || !lastName) {
    return { success: false, error: 'First and last name are required.' }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      role: data.role,
      active: data.active,
    })
    .eq('id', data.userId)

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath('/admin')
  revalidatePath('/planning')
  return { success: true }
}
