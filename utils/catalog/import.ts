import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'csv-parse/sync'

type ItemType = 'equipment' | 'part' | 'material_bundle' | 'labor' | 'profit'

type ItemRow = {
  'Product/Service Name': string
  Category: string
  Cost: string
}

type OperationRow = Record<string, string>

type ImportCounters = {
  itemsCreated: number
  itemsUpdated: number
  itemsAutoCreated: number
  diagnosesCreated: number
  diagnosesUpdated: number
  bundlesCreated: number
  bundlesUpdated: number
  bundleLinesImported: number
}

export type CatalogImportResult = ImportCounters & {
  importedRows: number
  autoCreatedItemNames: string[]
}

const ITEMS_FILE = path.join(process.cwd(), 'DATA', 'ITEMS.csv')
const OPERATIONS_FILE = path.join(process.cwd(), 'DATA', 'Operations - Invoicing - V2.csv')

const ITEM_NAME_ALIASES: Record<string, string> = {
  'brazing': 'Materials - Brazing',
  'contactor': 'Contactor - 24/240V',
  'draft assembly': 'Draft Inducer Assembly',
  'limit / sequencer': 'Limit/Sequencer',
  'minimal': 'Materials - Minimal',
  'press switch': 'Pressure Switch',
  'rev valve': 'Reversing Valve',
  'standard': 'Materials - Standard',
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function parseMoney(value: string | null | undefined) {
  const text = (value ?? '').trim().replace(/\$/g, '').replace(/,/g, '').replace(/%/g, '')
  if (!text) return 0
  const parsed = Number.parseFloat(text)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseBoolean(value: string | null | undefined) {
  return normalizeKey(value) === 'true'
}

function parseNumber(value: string | null | undefined) {
  const text = (value ?? '').trim()
  if (!text) return 0
  const parsed = Number.parseFloat(text)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function mergeRecord<T extends { id: string }>(existing: T, updates: Record<string, unknown>) {
  return { ...existing, ...updates } as T
}

function isEquipmentName(name: string) {
  const normalized = normalizeKey(name)
  return normalized === 'ahu' || normalized === 'furnace' || normalized === 'heat pump' || normalized === 'condenser'
}

function mapItemType(name: string, category: string): ItemType {
  const normalizedName = normalizeKey(name)
  const normalizedCategory = normalizeKey(category)

  if (normalizedName.includes('labor')) return 'labor'
  if (normalizedName === 'profit') return 'profit'
  if (normalizedCategory === 'equipment' || isEquipmentName(name)) return 'equipment'
  if (normalizedCategory === 'materials' || normalizedCategory === 'refrigerant') return 'material_bundle'
  return 'part'
}

function defaultUnitForType(type: ItemType) {
  if (type === 'labor') return 'hour'
  if (type === 'material_bundle') return 'each'
  return 'each'
}

function buildItemPayload(name: string, category: string, unitCost: number) {
  const type = mapItemType(name, category)
  return {
    name,
    type,
    unit_cost: roundMoney(unitCost),
    is_placeholder: unitCost <= 0 && type !== 'labor' && type !== 'profit',
    unit: type === 'material_bundle' && normalizeKey(category) === 'refrigerant'
      ? 'lb'
      : defaultUnitForType(type),
    alacarte_eligible: type !== 'labor' && type !== 'profit',
    active: true,
  }
}

async function readSeedCsv(filePath: string) {
  return readFile(filePath, 'utf8')
}

async function loadItemsCsv() {
  const text = await readSeedCsv(ITEMS_FILE)
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ItemRow[]
}

async function loadOperationsCsv() {
  const text = await readSeedCsv(OPERATIONS_FILE)
  const rows = parse(text, {
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][]

  const header = rows[1] ?? []
  return rows
    .slice(2)
    .map(row => Object.fromEntries(header.map((column, index) => [column, (row[index] ?? '').trim()])))
    .filter(row => row['Repair Code'])
}

async function getExistingItems(supabase: any) {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, type, unit_cost, is_placeholder, unit, alacarte_eligible, active')

  if (error) throw new Error(error.message)

  const byName = new Map<string, any>()
  for (const item of data ?? []) {
    byName.set(normalizeKey(item.name), item)
  }
  return byName
}

async function ensureItem(
  supabase: any,
  itemsByName: Map<string, any>,
  counters: ImportCounters,
  autoCreatedItemNames: Set<string>,
  name: string,
  category: string,
  unitCost: number,
  options?: { updateExisting?: boolean; countAsAutoCreated?: boolean },
) {
  const key = normalizeKey(name)
  const existing = itemsByName.get(key)
  const payload = buildItemPayload(name, category, unitCost)

  if (existing) {
    if (options?.updateExisting === false) return existing

    const { data, error } = await supabase
      .from('items')
      .update(payload)
      .eq('id', existing.id)
      .select('id, name, type, unit_cost, is_placeholder, unit, alacarte_eligible, active')

    if (error) throw new Error(error.message)
    const row = data?.[0] ?? mergeRecord(existing, payload)
    itemsByName.set(key, row)
    counters.itemsUpdated += 1
    return row
  }

  const { data, error } = await supabase
    .from('items')
    .insert(payload)
    .select('id, name, type, unit_cost, is_placeholder, unit, alacarte_eligible, active')

  if (error) throw new Error(error.message)
  const row = data?.[0]
  if (!row) throw new Error(`Item insert returned no row for ${name}.`)
  itemsByName.set(key, row)
  counters.itemsCreated += 1
  if (options?.countAsAutoCreated || !normalizeKey(category)) {
    counters.itemsAutoCreated += 1
    autoCreatedItemNames.add(name)
  }
  return row
}

function resolveOperationItemName(rawName: string, unitCost: number, column: 'part' | 'materials' | 'refrigerant') {
  if (!rawName) return null

  const normalized = normalizeKey(rawName)
  if (column === 'refrigerant') {
    if (Math.abs(unitCost - 18) < 0.01) return 'R32 Refrigerant'
    if (Math.abs(unitCost - 15) < 0.01) return 'R410A Refrigerant'
    return 'Refrigerant'
  }

  if (normalized === 'motor') {
    return Math.abs(unitCost - 70) < 0.01 ? 'Condenser Motor' : 'Blower Motor'
  }

  if (normalized === 'install') return 'Materials - Install'

  const alias = ITEM_NAME_ALIASES[normalized]
  if (alias) return alias
  return rawName.trim()
}

function inferCategoryForOperationItem(name: string, column: 'part' | 'materials' | 'refrigerant') {
  if (column === 'materials') return 'Materials'
  if (column === 'refrigerant') return 'Refrigerant'
  if (isEquipmentName(name)) return 'Equipment'
  if (normalizeKey(name).includes('labor')) return 'Services'
  if (normalizeKey(name) === 'profit') return 'Services'
  return 'Imported'
}

async function ensureOperationItem(
  supabase: any,
  itemsByName: Map<string, any>,
  counters: ImportCounters,
  autoCreatedItemNames: Set<string>,
  rawName: string,
  unitCost: number,
  column: 'part' | 'materials' | 'refrigerant',
) {
  const resolvedName = resolveOperationItemName(rawName, unitCost, column)
  if (!resolvedName) return null

  const existing = itemsByName.get(normalizeKey(resolvedName))
  if (existing) return existing

  return ensureItem(
    supabase,
    itemsByName,
    counters,
    autoCreatedItemNames,
    resolvedName,
    inferCategoryForOperationItem(resolvedName, column),
    unitCost,
    { countAsAutoCreated: true },
  )
}

function buildDiagnosisPayload(row: OperationRow) {
  return {
    location: row.Location,
    component: row.Component,
    action: row.Action,
    cat1: row['Cat 1'] || null,
    cat2: row['Cat 2'] || null,
    cat3: row['Cat 3'] || null,
    repair_notes: row['Repair Notes'] || null,
    invoice_description: row['QB Repair Description'] || null,
    variable_pricing: parseBoolean(row.Variable),
    one_shot: parseBoolean(row['One Shot']),
    est_work_hours: parseNumber(row['Total Time']) || null,
    historic_price: parseMoney(row['Historic Price']) || null,
    active: true,
  }
}

function buildBundlePayload(row: OperationRow, diagnosisId: string) {
  return {
    diagnosis_id: diagnosisId,
    name: row['Repair Code'],
    flat_rate: parseMoney(row['Flat Rate']) || null,
    addon_eligible: false,
    addon_description: null,
    notes: row['? / Note'] || null,
  }
}

async function upsertDiagnosis(
  supabase: any,
  diagnosesByCode: Map<string, any>,
  counters: ImportCounters,
  row: OperationRow,
) {
  const repairCode = row['Repair Code']
  const existing = diagnosesByCode.get(repairCode)
  const payload = buildDiagnosisPayload(row)

  if (existing) {
    const { data, error } = await supabase
      .from('diagnoses')
      .update(payload)
      .eq('id', existing.id)
      .select('id, repair_code')

    if (error) throw new Error(error.message)
    const rowData = data?.[0] ?? existing
    diagnosesByCode.set(repairCode, rowData)
    counters.diagnosesUpdated += 1
    return rowData
  }

  const { data, error } = await supabase
    .from('diagnoses')
    .insert(payload)
    .select('id, repair_code')

  if (error) throw new Error(error.message)
  const rowData = data?.[0]
  if (!rowData) throw new Error(`Diagnosis insert returned no row for ${repairCode}.`)
  diagnosesByCode.set(repairCode, rowData)
  counters.diagnosesCreated += 1
  return rowData
}

async function upsertBundle(
  supabase: any,
  bundlesByDiagnosis: Map<string, any>,
  counters: ImportCounters,
  row: OperationRow,
  diagnosisId: string,
) {
  const existing = bundlesByDiagnosis.get(diagnosisId)
  const payload = buildBundlePayload(row, diagnosisId)

  if (existing) {
    const { data, error } = await supabase
      .from('repair_bundles')
      .update(payload)
      .eq('id', existing.id)
      .select('id, diagnosis_id')

    if (error) throw new Error(error.message)
    const rowData = data?.[0] ?? existing
    bundlesByDiagnosis.set(diagnosisId, rowData)
    counters.bundlesUpdated += 1
    return rowData
  }

  const { data, error } = await supabase
    .from('repair_bundles')
    .insert(payload)
    .select('id, diagnosis_id')

  if (error) throw new Error(error.message)
  const rowData = data?.[0]
  if (!rowData) throw new Error(`Bundle insert returned no row for diagnosis ${diagnosisId}.`)
  bundlesByDiagnosis.set(diagnosisId, rowData)
  counters.bundlesCreated += 1
  return rowData
}

async function replaceBundleLines(
  supabase: any,
  bundleId: string,
  lines: Array<{ item_id: string; quantity: number; cost_at_build: number }>,
) {
  const { error: deleteError } = await supabase
    .from('repair_bundle_lines')
    .delete()
    .eq('bundle_id', bundleId)

  if (deleteError) throw new Error(deleteError.message)

  if (!lines.length) return

  const { error: insertError } = await supabase
    .from('repair_bundle_lines')
    .insert(lines.map(line => ({ bundle_id: bundleId, ...line })))

  if (insertError) throw new Error(insertError.message)
}

async function buildBundleLines(
  supabase: any,
  itemsByName: Map<string, any>,
  counters: ImportCounters,
  autoCreatedItemNames: Set<string>,
  row: OperationRow,
) {
  const lines: Array<{ item_id: string; quantity: number; cost_at_build: number }> = []

  for (const nameColumn of ['Part 1', 'Part 2', 'Part 3'] as const) {
    const rawName = row[nameColumn]
    const rawCost = row[`${nameColumn} $`]
    if (!rawName) continue

    const unitCost = parseMoney(rawCost)
    const item = await ensureOperationItem(
      supabase,
      itemsByName,
      counters,
      autoCreatedItemNames,
      rawName,
      unitCost,
      'part',
    )
    if (!item) continue

    lines.push({
      item_id: item.id,
      quantity: 1,
      cost_at_build: roundMoney(unitCost),
    })
  }

  const refrigerantQty = parseNumber(row.Refrigerant)
  const refrigerantTotalCost = parseMoney(row['Refrigerant $'])
  if (refrigerantQty > 0 && refrigerantTotalCost > 0) {
    const unitCost = roundMoney(refrigerantTotalCost / refrigerantQty)
    const refrigerantItem = await ensureOperationItem(
      supabase,
      itemsByName,
      counters,
      autoCreatedItemNames,
      row.Refrigerant,
      unitCost,
      'refrigerant',
    )
    if (refrigerantItem) {
      lines.push({
        item_id: refrigerantItem.id,
        quantity: refrigerantQty,
        cost_at_build: unitCost,
      })
    }
  }

  const materialName = row.Materials
  const materialCost = parseMoney(row['Material $'])
  if (materialName && materialCost > 0) {
    const materialItem = await ensureOperationItem(
      supabase,
      itemsByName,
      counters,
      autoCreatedItemNames,
      materialName,
      materialCost,
      'materials',
    )
    if (materialItem) {
      lines.push({
        item_id: materialItem.id,
        quantity: 1,
        cost_at_build: roundMoney(materialCost),
      })
    }
  }

  const laborCost = parseMoney(row['Labor Cost'])
  const totalTime = parseNumber(row['Total Time'])
  if (laborCost > 0) {
    const laborItem = await ensureItem(
      supabase,
      itemsByName,
      counters,
      autoCreatedItemNames,
      'Labor - Hour',
      'Services',
      parseMoney('90'),
      { updateExisting: false },
    )
    const laborUnitCost = laborItem.unit_cost > 0 ? Number(laborItem.unit_cost) : 90
    const quantity = totalTime > 0 ? totalTime : roundMoney(laborCost / laborUnitCost)
    lines.push({
      item_id: laborItem.id,
      quantity: quantity > 0 ? quantity : 1,
      cost_at_build: roundMoney(laborUnitCost),
    })
  }

  const profitCost = parseMoney(row.Profit)
  if (profitCost > 0) {
    const profitItem = await ensureItem(
      supabase,
      itemsByName,
      counters,
      autoCreatedItemNames,
      'Profit',
      'Services',
      0,
      { updateExisting: false },
    )
    lines.push({
      item_id: profitItem.id,
      quantity: 1,
      cost_at_build: roundMoney(profitCost),
    })
  }

  return lines
}

export async function importItemsSeed(supabase: any) {
  const counters: ImportCounters = {
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsAutoCreated: 0,
    diagnosesCreated: 0,
    diagnosesUpdated: 0,
    bundlesCreated: 0,
    bundlesUpdated: 0,
    bundleLinesImported: 0,
  }
  const autoCreatedItemNames = new Set<string>()
  const itemsByName = await getExistingItems(supabase)
  const rows = await loadItemsCsv()

  for (const row of rows) {
    const name = row['Product/Service Name']?.trim()
    if (!name) continue
    const cost = parseMoney(row.Cost)
    await ensureItem(
      supabase,
      itemsByName,
      counters,
      autoCreatedItemNames,
      name,
      row.Category ?? '',
      cost,
      { updateExisting: true },
    )
  }

  return {
    importedRows: rows.length,
    autoCreatedItemNames: Array.from(autoCreatedItemNames).sort(),
    ...counters,
  } satisfies CatalogImportResult
}

export async function importOperationsSeed(supabase: any) {
  const counters: ImportCounters = {
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsAutoCreated: 0,
    diagnosesCreated: 0,
    diagnosesUpdated: 0,
    bundlesCreated: 0,
    bundlesUpdated: 0,
    bundleLinesImported: 0,
  }
  const autoCreatedItemNames = new Set<string>()
  const rows = await loadOperationsCsv()

  const itemsByName = await getExistingItems(supabase)

  const { data: diagnoses, error: diagnosesError } = await supabase
    .from('diagnoses')
    .select('id, repair_code')
  if (diagnosesError) throw new Error(diagnosesError.message)
  const diagnosesByCode = new Map<string, any>()
  for (const diagnosis of diagnoses ?? []) {
    diagnosesByCode.set(diagnosis.repair_code, diagnosis)
  }

  const { data: bundles, error: bundlesError } = await supabase
    .from('repair_bundles')
    .select('id, diagnosis_id')
  if (bundlesError) throw new Error(bundlesError.message)
  const bundlesByDiagnosis = new Map<string, any>()
  for (const bundle of bundles ?? []) {
    bundlesByDiagnosis.set(bundle.diagnosis_id, bundle)
  }

  for (const row of rows) {
    const diagnosis = await upsertDiagnosis(supabase, diagnosesByCode, counters, row)
    const bundle = await upsertBundle(supabase, bundlesByDiagnosis, counters, row, diagnosis.id)
    const lines = await buildBundleLines(supabase, itemsByName, counters, autoCreatedItemNames, row)
    await replaceBundleLines(supabase, bundle.id, lines)
    counters.bundleLinesImported += lines.length
  }

  return {
    importedRows: rows.length,
    autoCreatedItemNames: Array.from(autoCreatedItemNames).sort(),
    ...counters,
  } satisfies CatalogImportResult
}

export async function importFullCatalogSeed(supabase: any) {
  const itemsResult = await importItemsSeed(supabase)
  const operationsResult = await importOperationsSeed(supabase)

  return {
    importedRows: itemsResult.importedRows + operationsResult.importedRows,
    itemsCreated: itemsResult.itemsCreated + operationsResult.itemsCreated,
    itemsUpdated: itemsResult.itemsUpdated + operationsResult.itemsUpdated,
    itemsAutoCreated: itemsResult.itemsAutoCreated + operationsResult.itemsAutoCreated,
    diagnosesCreated: operationsResult.diagnosesCreated,
    diagnosesUpdated: operationsResult.diagnosesUpdated,
    bundlesCreated: operationsResult.bundlesCreated,
    bundlesUpdated: operationsResult.bundlesUpdated,
    bundleLinesImported: operationsResult.bundleLinesImported,
    autoCreatedItemNames: Array.from(new Set([
      ...itemsResult.autoCreatedItemNames,
      ...operationsResult.autoCreatedItemNames,
    ])).sort(),
  } satisfies CatalogImportResult
}
