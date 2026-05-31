'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import {
  importFullCatalogSeed,
  importItemsSeed,
  importOperationsSeed,
  type CatalogImportResult,
} from '@/utils/catalog/import'

type CatalogActionResult =
  | ({ success: true; label: string } & CatalogImportResult)
  | { success: false; error: string }

type CatalogSupabase = Awaited<ReturnType<typeof createClient>>

async function requireCatalogAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Not authenticated' as const }

  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { supabase, error: error.message }
  if (!profile || !['admin', 'owner', 'dispatcher'].includes(profile.role)) {
    return { supabase, error: 'Catalog import is limited to admin, owner, or dispatcher roles.' }
  }

  return { supabase, error: null }
}

async function runCatalogImport(
  label: string,
  importer: (supabase: CatalogSupabase) => Promise<CatalogImportResult>,
): Promise<CatalogActionResult> {
  const { supabase, error } = await requireCatalogAdmin()
  if (error) return { success: false, error }

  try {
    const result = await importer(supabase)
    revalidatePath('/catalog')
    revalidatePath('/jobs')
    revalidatePath('/invoices')
    return { success: true, label, ...result }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Catalog import failed.',
    }
  }
}

export async function importSeedItemsAction() {
  return runCatalogImport('Items import', importItemsSeed)
}

export async function importSeedOperationsAction() {
  return runCatalogImport('Bundles import', importOperationsSeed)
}

export async function importFullCatalogAction() {
  return runCatalogImport('Full catalog import', importFullCatalogSeed)
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export async function updateAppConfigAction(data: {
  labor_cost_per_hour: number
  travel_time_hours: number
  refrigerant_cost_per_lb: number
  profit_per_hour_target: number
}) {
  const { supabase, error } = await requireCatalogAdmin()
  if (error) return { success: false, error }

  const payload = {
    labor_cost_per_hour: data.labor_cost_per_hour,
    travel_time_hours: data.travel_time_hours,
    refrigerant_cost_per_lb: data.refrigerant_cost_per_lb,
    profit_per_hour_target: data.profit_per_hour_target,
  }

  const { error: updateError } = await supabase
    .from('app_config')
    .upsert({ id: 1, ...payload }, { onConflict: 'id' })

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath('/admin')
  revalidatePath('/invoices')
  return { success: true }
}

export async function updateRepairTemplateAction(data: {
  diagnosisId: string
  bundleId: string | null
  repairCode: string
  invoiceDescription: string
  repairNotes: string
  variablePricing: boolean
  oneShot: boolean
  active: boolean
  flatRate: string
  travelTimeHours: string
  workTimeHours: string
  totalTimeHours: string
  laborCost: string
  partMaterialCost: string
  profitAmount: string
  profitPerHour: string
  marginPercent: string
  refrigerantLbs: string
  refrigerantCost: string
  materialsLabel: string
  materialCost: string
  pricingNotes: string
}) {
  const { supabase, error } = await requireCatalogAdmin()
  if (error) return { success: false, error }

  const repairCode = data.repairCode.trim()
  if (!repairCode) {
    return { success: false, error: 'Repair code is required.' }
  }

  const diagnosisPayload = {
    repair_code: repairCode,
    invoice_description: data.invoiceDescription.trim() || null,
    repair_notes: data.repairNotes.trim() || null,
    variable_pricing: data.variablePricing,
    one_shot: data.oneShot,
    active: data.active,
  }

  const bundlePayload = {
    name: repairCode,
    flat_rate: parseNullableNumber(data.flatRate),
    travel_time_hours: parseNullableNumber(data.travelTimeHours),
    work_time_hours: parseNullableNumber(data.workTimeHours),
    total_time_hours: parseNullableNumber(data.totalTimeHours),
    labor_cost: parseNullableNumber(data.laborCost),
    part_material_cost: parseNullableNumber(data.partMaterialCost),
    profit_amount: parseNullableNumber(data.profitAmount),
    profit_per_hour: parseNullableNumber(data.profitPerHour),
    margin_percent: (() => {
      const parsed = parseNullableNumber(data.marginPercent)
      return parsed == null ? null : parsed / 100
    })(),
    refrigerant_lbs: parseNullableNumber(data.refrigerantLbs),
    refrigerant_cost: parseNullableNumber(data.refrigerantCost),
    materials_label: data.materialsLabel.trim() || null,
    material_cost: parseNullableNumber(data.materialCost),
    pricing_notes: data.pricingNotes.trim() || null,
  }

  const { error: diagnosisError } = await supabase
    .from('diagnoses')
    .update(diagnosisPayload)
    .eq('id', data.diagnosisId)

  if (diagnosisError) return { success: false, error: diagnosisError.message }

  if (data.bundleId) {
    const { error: bundleError } = await supabase
      .from('repair_bundles')
      .update(bundlePayload)
      .eq('id', data.bundleId)

    if (bundleError) return { success: false, error: bundleError.message }
  }

  revalidatePath('/admin')
  revalidatePath('/jobs')
  revalidatePath('/invoices')
  return { success: true }
}
