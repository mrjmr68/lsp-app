import { createClient } from '@/utils/supabase/server'

export type AppRole = 'tech' | 'dispatcher' | 'admin' | 'owner'

export async function getAuthenticatedRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      supabase,
      user: null,
      role: null as AppRole | null,
      error: 'Not authenticated',
    }
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return {
      supabase,
      user,
      role: null as AppRole | null,
      error: error.message,
    }
  }

  return {
    supabase,
    user,
    role: (profile?.role ?? null) as AppRole | null,
    error: profile?.role ? null : 'User profile not found.',
  }
}

export async function requireRole(allowedRoles: AppRole | AppRole[]) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  const result = await getAuthenticatedRole()

  if (result.error) return result
  if (!result.role || !allowed.includes(result.role)) {
    return {
      ...result,
      error: `Access is limited to ${allowed.join(', ')} role${allowed.length === 1 ? '' : 's'}.`,
    }
  }

  return result
}
