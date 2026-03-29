/**
 * verify-import.mjs
 *
 * Checks that the Call History import landed correctly in Supabase.
 * Compares counts and spot-checks key values against the source CSV.
 *
 * Run from lsp-app root:
 *   SUPABASE_SERVICE_KEY=your_key node DATA/verify-import.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { parse } from 'csv-parse/sync'
import path from 'path'
import { fileURLToPath } from 'url'

const SUPABASE_URL = 'https://ifneznpvppgqlfidwysi.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_KEY')
  console.error('   Run as: SUPABASE_SERVICE_KEY=your_key node DATA/verify-import.mjs\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CSV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'Call History.csv')

function parseCurrency(val) {
  if (!val || !val.trim()) return null
  const n = parseFloat(val.replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

async function main() {
  console.log('\n📊 LSP Import Verification\n' + '─'.repeat(40))

  // ── 1. Total job count in DB ──────────────────────────────────────────────
  const { count: totalJobs, error: countErr } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
  if (countErr) throw countErr
  console.log(`\nTotal jobs in database:        ${totalJobs}`)

  // ── 2. Invoiced jobs (historical imports) ─────────────────────────────────
  const { count: invoicedJobs, error: invErr } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'invoiced')
  if (invErr) throw invErr
  console.log(`Jobs with status = invoiced:   ${invoicedJobs}`)

  // ── 3. Compare to CSV ─────────────────────────────────────────────────────
  const raw = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^\uFEFF/, '')
  const csvRows = parse(raw, { columns: true, skip_empty_lines: true })
  console.log(`Rows in source CSV:            ${csvRows.length}`)

  const delta = invoicedJobs - csvRows.length
  if (delta === 0) {
    console.log(`\n✅ Count matches CSV exactly.`)
  } else if (delta > 0) {
    console.log(`\n⚠️  ${delta} more records in DB than CSV (possible duplicate run).`)
  } else {
    console.log(`\n⚠️  ${Math.abs(delta)} fewer records in DB than CSV — some rows may have been skipped.`)
  }

  // ── 4. Breakdown by location ──────────────────────────────────────────────
  const { data: byLocation, error: locErr } = await supabase
    .from('jobs')
    .select('location_id, locations(name)')
    .eq('status', 'invoiced')
  if (locErr) throw locErr

  const locationCounts = {}
  for (const job of byLocation) {
    const name = job.locations?.name ?? 'Unknown'
    locationCounts[name] = (locationCounts[name] ?? 0) + 1
  }

  // Compare to CSV location counts
  const csvLocationCounts = {}
  for (const row of csvRows) {
    const name = row['location']?.trim() ?? 'Unknown'
    csvLocationCounts[name] = (csvLocationCounts[name] ?? 0) + 1
  }

  console.log(`\n${'Location'.padEnd(35)} ${'CSV'.padStart(5)} ${'DB'.padStart(5)} ${'Match'.padStart(6)}`)
  console.log('─'.repeat(52))

  const allLocations = new Set([...Object.keys(csvLocationCounts), ...Object.keys(locationCounts)])
  let mismatches = 0
  for (const loc of [...allLocations].sort()) {
    const csvCount = csvLocationCounts[loc] ?? 0
    const dbCount = locationCounts[loc] ?? 0
    const match = csvCount === dbCount ? '✅' : '❌'
    if (csvCount !== dbCount) mismatches++
    console.log(`${loc.padEnd(35)} ${String(csvCount).padStart(5)} ${String(dbCount).padStart(5)} ${match.padStart(6)}`)
  }

  if (mismatches === 0) {
    console.log('\n✅ All location counts match.')
  } else {
    console.log(`\n⚠️  ${mismatches} location(s) have count mismatches.`)
  }

  // ── 5. Spot-check: diagnosis code coverage ────────────────────────────────
  const { data: diagJobs, error: diagErr } = await supabase
    .from('jobs')
    .select('diagnosis_id, diagnosis_raw')
    .eq('status', 'invoiced')
  if (diagErr) throw diagErr

  const withDiagnosis = diagJobs.filter(j => j.diagnosis_id !== null).length
  const withRaw = diagJobs.filter(j => !j.diagnosis_id && j.diagnosis_raw).length
  const withNeither = diagJobs.filter(j => !j.diagnosis_id && !j.diagnosis_raw).length

  console.log(`\n── Diagnosis coverage ──────────────────────────`)
  console.log(`Matched to catalog:  ${withDiagnosis}`)
  console.log(`Stored as raw only:  ${withRaw}`)
  console.log(`No diagnosis at all: ${withNeither}`)

  // ── 6. Spot-check: invoice totals ────────────────────────────────────────
  const { data: invoiceSample, error: sampleErr } = await supabase
    .from('jobs')
    .select('invoice_amount, invoice_subtotal')
    .eq('status', 'invoiced')
    .not('invoice_amount', 'is', null)
    .gt('invoice_amount', 0)
    .limit(5)
  if (sampleErr) throw sampleErr

  const csvTotals = csvRows
    .map(r => parseCurrency(r['invoice_total']))
    .filter(n => n !== null && n > 0)

  const csvGrandTotal = csvTotals.reduce((a, b) => a + b, 0)

  const { data: dbTotals, error: totalErr } = await supabase
    .from('jobs')
    .select('invoice_amount')
    .eq('status', 'invoiced')
  if (totalErr) throw totalErr

  const dbGrandTotal = dbTotals.reduce((sum, j) => sum + (j.invoice_amount ?? 0), 0)

  console.log(`\n── Invoice totals ──────────────────────────────`)
  console.log(`CSV grand total:  $${csvGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
  console.log(`DB grand total:   $${dbGrandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)

  const totalDelta = Math.abs(csvGrandTotal - dbGrandTotal)
  if (totalDelta < 0.02) {
    console.log(`✅ Totals match.`)
  } else {
    console.log(`⚠️  Delta: $${totalDelta.toFixed(2)}`)
  }

  console.log('\n' + '─'.repeat(40) + '\nVerification complete.\n')
}

main().catch(err => {
  console.error('\n💥 Error:', err.message)
  process.exit(1)
})
