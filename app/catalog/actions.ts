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
  importer: (supabase: any) => Promise<CatalogImportResult>,
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
