/**
 * import-call-history.mjs
 *
 * Imports Call History.csv into Supabase as historical Job records.
 *
 * Run from the lsp-app root:
 *   node DATA/import-call-history.mjs
 *
 * PowerShell:
 *   $env:SUPABASE_SERVICE_KEY="your_key"; node DATA/import-call-history.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { fileURLToPath } from 'url'

// ── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ifneznpvppgqlfidwysi.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_KEY environment variable.')
  console.error('   PowerShell: $env:SUPABASE_SERVICE_KEY="your_key"; node DATA/import-call-history.mjs\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CSV_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'Call History.csv'
)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "$1,293.50" → 1293.50  |  "" or "$0.00" → null */
function parseCurrency(val) {
  if (!val || !val.trim()) return null
  const n = parseFloat(val.replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

/** "6.75%" → 0.0675  |  "" → null */
function parseTaxRate(val) {
  if (!val || !val.trim()) return null
  const n = parseFloat(val.replace('%', '')) / 100
  return isNaN(n) ? null : n
}

/** "06/06/25 1:19 PM" → "2025-06-06" */
function parseDate(val) {
  if (!val || !val.trim()) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim()
  const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})/)
  if (m) {
    const year = parseInt(m[3]) + 2000
    const month = m[1].padStart(2, '0')
    const day = m[2].padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📂 Reading CSV...')
  const raw = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^\uFEFF/, '') // strip BOM
  const rows = parse(raw, { columns: true, skip_empty_lines: true })
  console.log(`   ${rows.length} rows found`)

  // ── 1. Load reference data ────────────────────────────────────────────────

  console.log('\n📡 Loading reference data from Supabase...')

  const { data: customers, error: custErr } = await supabase
    .from('customers').select('id, name')
  if (custErr) throw custErr

  const { data: locations, error: locErr } = await supabase
    .from('locations').select('id, name, customer_id')
  if (locErr) throw locErr

  const { data: diagnoses, error: diagErr } = await supabase
    .from('diagnoses').select('id, repair_code')
  if (diagErr) throw diagErr

  const locationByName  = new Map(locations.map(l => [l.name.toLowerCase().trim(), l]))
  const diagnosisByCode = new Map(diagnoses.map(d => [d.repair_code.toLowerCase().trim(), d]))

  console.log(`   ${customers.length} customers, ${locations.length} locations, ${diagnoses.length} diagnoses`)

  // ── 2. Process rows ───────────────────────────────────────────────────────

  const toInsert = []
  const skipped  = []
  const warnings = []

  for (const row of rows) {
    const locationName   = row['location']?.trim()
    const diagnosisCode  = row['diagnosis']?.trim()
    const diagnosisRaw   = row['diagnosis_raw']?.trim()
    const jobDate        = parseDate(row['job_date'])

    // Location is required
    const location = locationByName.get(locationName?.toLowerCase())
    if (!location) {
      skipped.push({ reason: 'Location not found in DB', location: locationName })
      continue
    }

    if (!jobDate) {
      skipped.push({ reason: 'Could not parse job_date', date: row['job_date'] })
      continue
    }

    // Diagnosis — optional but warn if provided and unmatched
    let diagnosisId  = null
    let adminNotes   = null

    if (diagnosisCode) {
      const diagnosis = diagnosisByCode.get(diagnosisCode.toLowerCase())
      if (diagnosis) {
        diagnosisId = diagnosis.id
      } else {
        // Store unmatched code in admin_notes for review
        adminNotes = `[Import] Unmatched diagnosis code: "${diagnosisCode}"${diagnosisRaw ? ` | raw: "${diagnosisRaw}"` : ''}`
        warnings.push({ reason: 'Diagnosis code not in catalog', code: diagnosisCode, location: locationName })
      }
    } else if (diagnosisRaw) {
      adminNotes = `[Import] No diagnosis code. Raw: "${diagnosisRaw}"`
    }

    const invoiceSubtotal = parseCurrency(row['invoice_subtotal'])
    const taxRate         = parseTaxRate(row['tax_rate'])
    const invoiceTax      = parseCurrency(row['invoice_tax'])
    const invoiceTotal    = parseCurrency(row['invoice_total'])

    toInsert.push({
      customer_id:      location.customer_id,
      location_id:      location.id,
      status:           'invoiced',
      job_date:         jobDate,
      how_it_came_in:   'dispatcher',
      manual_unit:      row['unit']?.trim() || null,
      diagnosis_id:     diagnosisId,
      admin_notes:      adminNotes,
      // Invoice fields (migration 006 columns)
      invoice_subtotal: invoiceSubtotal,
      tax_rate:         taxRate,
      invoice_tax:      invoiceTax,
      invoice_total:    invoiceTotal,
      // Legacy total-only field (migration 003) — also populate for compatibility
      invoice_amount:   invoiceTotal,
    })
  }

  // ── 3. Pre-flight summary ─────────────────────────────────────────────────

  console.log('\n📋 Pre-flight summary:')
  console.log(`   ✅ Ready to insert: ${toInsert.length}`)
  console.log(`   ⚠️  Warnings:        ${warnings.length}`)
  console.log(`   ❌ Skipped:          ${skipped.length}`)

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings (will still insert, code saved to admin_notes):')
    warnings.forEach(w => console.log(`   "${w.code}" at ${w.location}`))
  }

  if (skipped.length > 0) {
    console.log('\n❌ Skipped (cannot insert — fix and re-run):')
    skipped.forEach(s => console.log(`   [${s.reason}] ${s.location ?? s.date ?? ''}`))
  }

  if (toInsert.length === 0) {
    console.log('\n🛑 Nothing to insert. Exiting.')
    return
  }

  // ── 4. Insert in batches of 100 ──────────────────────────────────────────

  const BATCH_SIZE = 100
  let inserted = 0
  let failed   = 0

  console.log(`\n⬆️  Inserting ${toInsert.length} records...`)

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('jobs').insert(batch)
    if (error) {
      console.error(`\n   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`)
      failed += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`   ✅ ${inserted}/${toInsert.length}\r`)
    }
  }

  // ── 5. Final report ───────────────────────────────────────────────────────

  console.log(`\n\n🏁 Done.`)
  console.log(`   Inserted: ${inserted}`)
  console.log(`   Skipped:  ${skipped.length}`)
  console.log(`   Failed:   ${failed}`)

  if (failed > 0) {
    console.log('\n💡 Some batches failed. Check error messages above.')
    console.log('   Delete the imported records before re-running to avoid duplicates:')
    console.log("   DELETE FROM jobs WHERE status = 'invoiced';")
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})
