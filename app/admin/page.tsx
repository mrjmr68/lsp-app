import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import { createClient } from '@/utils/supabase/server'
import AdminHub from './AdminHub'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: itemCount },
    { count: diagnosisCount },
    { count: bundleCount },
    { count: bundleLineCount },
    { data: profile },
    { data: users },
  ] = await Promise.all([
    supabase.from('items').select('id', { count: 'exact', head: true }),
    supabase.from('diagnoses').select('id', { count: 'exact', head: true }),
    supabase.from('repair_bundles').select('id', { count: 'exact', head: true }),
    supabase.from('repair_bundle_lines').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('users').select('id, first_name, last_name, phone, role, active').order('first_name').order('last_name'),
  ])

  const currentRole = profile?.role ?? ''
  const canManageCatalog = ['admin', 'owner', 'dispatcher'].includes(currentRole)
  const canManageUsers = ['admin', 'owner'].includes(currentRole)

  return (
    <AppShell>
      <AdminHub
        counts={{
          items: itemCount ?? 0,
          diagnoses: diagnosisCount ?? 0,
          bundles: bundleCount ?? 0,
          bundleLines: bundleLineCount ?? 0,
        }}
        users={(users ?? []) as any}
        canManageCatalog={canManageCatalog}
        canManageUsers={canManageUsers}
      />
    </AppShell>
  )
}
