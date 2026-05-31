import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import { createClient } from '@/utils/supabase/server'
import AdminHub from './AdminHub'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : (value ?? null)
}

type AdminUser = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  role: 'tech' | 'dispatcher' | 'admin' | 'owner'
  active: boolean
}

type AdminAppConfig = {
  labor_cost_per_hour: number
  travel_time_hours: number
  refrigerant_cost_per_lb: number
  profit_per_hour_target: number
}

type AdminCatalogTemplate = {
  id: string
  location: string
  component: string
  action: string
  repair_code: string
  invoice_description: string | null
  repair_notes: string | null
  variable_pricing: boolean
  one_shot: boolean
  active: boolean
  repair_bundles: {
    id: string
    flat_rate: number | null
    travel_time_hours: number | null
    work_time_hours: number | null
    total_time_hours: number | null
    labor_cost: number | null
    part_material_cost: number | null
    profit_amount: number | null
    profit_per_hour: number | null
    margin_percent: number | null
    refrigerant_lbs: number | null
    refrigerant_cost: number | null
    materials_label: string | null
    material_cost: number | null
    pricing_notes: string | null
  } | null
}

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
    { data: appConfig },
    { data: catalogTemplates },
  ] = await Promise.all([
    supabase.from('items').select('id', { count: 'exact', head: true }),
    supabase.from('diagnoses').select('id', { count: 'exact', head: true }),
    supabase.from('repair_bundles').select('id', { count: 'exact', head: true }),
    supabase.from('repair_bundle_lines').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('users').select('id, first_name, last_name, phone, role, active').order('first_name').order('last_name'),
    supabase.from('app_config').select('labor_cost_per_hour, travel_time_hours, refrigerant_cost_per_lb, profit_per_hour_target').eq('id', 1).maybeSingle(),
    supabase
      .from('diagnoses')
      .select(`
        id, location, component, action, repair_code, invoice_description, repair_notes, variable_pricing, one_shot, active,
        repair_bundles(
          id, flat_rate, travel_time_hours, work_time_hours, total_time_hours,
          labor_cost, part_material_cost, profit_amount, profit_per_hour, margin_percent,
          refrigerant_lbs, refrigerant_cost, materials_label, material_cost, pricing_notes
        )
      `)
      .order('repair_code')
      .limit(150),
  ])

  const currentRole = profile?.role ?? ''
  const canManageCatalog = ['admin', 'owner', 'dispatcher'].includes(currentRole)
  const canManageUsers = ['admin', 'owner'].includes(currentRole)
  const normalizedTemplates = (catalogTemplates ?? []).map(template => ({
    ...template,
    repair_bundles: firstRelation(template.repair_bundles),
  })) as AdminCatalogTemplate[]

  return (
    <AppShell>
      <AdminHub
        counts={{
          items: itemCount ?? 0,
          diagnoses: diagnosisCount ?? 0,
          bundles: bundleCount ?? 0,
          bundleLines: bundleLineCount ?? 0,
        }}
        users={(users ?? []) as AdminUser[]}
        appConfig={(appConfig ?? null) as AdminAppConfig | null}
        catalogTemplates={normalizedTemplates}
        canManageCatalog={canManageCatalog}
        canManageUsers={canManageUsers}
      />
    </AppShell>
  )
}
