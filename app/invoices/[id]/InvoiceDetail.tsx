'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  InvoiceAdhocBundle,
  InvoiceJob,
  InvoiceRepairBundle,
  InvoiceAddOn,
  PlaceholderCost,
  ParentCustomer,
  VarianceData,
  PhotoCounts,
} from '../types'
import {
  savePlaceholderCost,
  saveAdminNotes,
  saveFlatRateOverride,
  flagForReview,
  approveInvoice,
} from './actions'

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  job: InvoiceJob
  bundle: InvoiceRepairBundle | null
  adhocBundle: InvoiceAdhocBundle | null
  addOns: InvoiceAddOn[]
  placeholderCosts: PlaceholderCost[]
  parentCustomer: ParentCustomer | null
  variance: VarianceData | null
  photoCounts: PhotoCounts
  invoicePdfUrl: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_VISIT_REPAIRS: NonNullable<InvoiceJob['service_visit']>['visit_repairs'] = []

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function relativeTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '')
  if (sameDay) return `Today · ${time}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` · ${time}`
}

function durationStr(arrivedAt: string | null, completedAt: string | null) {
  if (!arrivedAt || !completedAt) return '—'
  const mins = Math.round((new Date(completedAt).getTime() - new Date(arrivedAt).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`
}

// ── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, rightText, children }: { title: string; rightText?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{
        padding: '11px 16px',
        borderBottom: '1px solid #e2e1da',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#888780' }}>
          {title}
        </div>
        {rightText && <span style={{ fontSize: '11px', color: '#888780' }}>{rightText}</span>}
      </div>
      <div style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function InvoiceDetail({
  job,
  bundle,
  adhocBundle,
  addOns,
  placeholderCosts: initialCosts,
  parentCustomer,
  variance,
  photoCounts,
  invoicePdfUrl,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const estimateRecord = Array.isArray(job.job_estimates) ? (job.job_estimates[0] ?? null) : (job.job_estimates ?? null)
  const partsRequest = Array.isArray(job.job_parts_requests) ? (job.job_parts_requests[0] ?? null) : (job.job_parts_requests ?? null)
  const invoiceSnapshot = job.invoice_snapshot ?? null
  const visitRepairs = job.service_visit?.visit_repairs ?? EMPTY_VISIT_REPAIRS
  const hasVisitRepairs = visitRepairs.length > 0
  const firstVisitRepair = visitRepairs[0] ?? null

  // ── State ────────────────────────────────────────────────────────────────

  // Placeholder costs — keyed by item_id → actual_cost
  const [localCosts, setLocalCosts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const c of initialCosts) {
      if (c.actual_cost != null) m[c.item_id] = String(c.actual_cost)
    }
    return m
  })

  const [adminNotes, setAdminNotes] = useState(job.admin_notes ?? '')
  const [flatRateStr, setFlatRateStr] = useState(
    String(job.flat_rate_override ?? (visitRepairs.length === 1 ? firstVisitRepair?.flat_rate_amount : null) ?? bundle?.flat_rate ?? '')
  )
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Pre-fill billing email
  const billToCustomer = parentCustomer ?? job.customers
  const [sendToEmail, setSendToEmail] = useState(invoiceSnapshot?.send_to_email ?? estimateRecord?.send_to_email ?? billToCustomer?.billing_email ?? '')
  const [ccEmail, setCcEmail] = useState(invoiceSnapshot?.cc_email ?? estimateRecord?.cc_email ?? '')

  // ── Placeholder items detection ──────────────────────────────────────────

  const placeholderItems = useMemo(() => {
    const lines = bundle?.repair_bundle_lines ?? adhocBundle?.job_adhoc_bundle_lines ?? []
    return lines
      .filter(l => l.items?.is_placeholder)
      .map(l => l.items!)
  }, [adhocBundle, bundle])

  const hasUnfilledPlaceholders = useMemo(() => {
    return placeholderItems.some(item => {
      const val = parseFloat(localCosts[item.id] ?? '')
      return isNaN(val) || val <= 0
    })
  }, [placeholderItems, localCosts])

  // ── Invoice calculation ──────────────────────────────────────────────────

  const invoiceCalc = useMemo(() => {
    if (invoiceSnapshot?.line_items?.length) {
      return {
        primaryCharge: invoiceSnapshot.line_items[0]?.amount ?? 0,
        addOnCharges: invoiceSnapshot.line_items.slice(1).reduce((sum, item) => sum + item.amount, 0),
        lineItems: invoiceSnapshot.line_items,
        subtotal: invoiceSnapshot.subtotal,
        taxRate: invoiceSnapshot.tax_rate,
        tax: invoiceSnapshot.tax,
        total: invoiceSnapshot.total,
      }
    }

    const parsedOverride = parseFloat(flatRateStr)
    let usedVisitOverride = false
    const visitRepairLineItems = visitRepairs.map(repair => {
      const quantity = Number(repair.quantity ?? 1)
      const storedAmount = repair.flat_rate_amount == null ? null : Number(repair.flat_rate_amount) * quantity
      const shouldUseOverride = repair.variable_pricing || !storedAmount || storedAmount <= 0
      const amount = shouldUseOverride && !isNaN(parsedOverride) && !usedVisitOverride
        ? parsedOverride
        : (storedAmount ?? 0)

      if (shouldUseOverride && !isNaN(parsedOverride) && !usedVisitOverride) {
        usedVisitOverride = true
      }

      return {
        label: repair.customer_description ?? repair.repair_code ?? repair.description_title,
        amount,
      }
    })
    const fallbackPrimaryCharge = !isNaN(parsedOverride) ? parsedOverride : (bundle?.flat_rate ?? 0)
    const fallbackLineItems = hasVisitRepairs
      ? [
          ...visitRepairLineItems,
          ...addOns.map(a => ({
            label: a.type === 'bundle' ? (a.repair_bundles?.name ?? 'Additional bundle') : (a.items?.name ?? 'Additional item'),
            amount: a.type === 'bundle' ? (a.repair_bundles?.flat_rate ?? 0) : (a.items?.unit_cost ?? 0) * a.quantity,
          })),
        ]
      : [
          {
            label: job.diagnoses?.repair_code ?? (adhocBundle ? 'Ad-hoc repair' : 'Service'),
            amount: fallbackPrimaryCharge,
          },
          ...addOns.map(a => ({
            label: a.type === 'bundle' ? (a.repair_bundles?.name ?? 'Additional bundle') : (a.items?.name ?? 'Additional item'),
            amount: a.type === 'bundle' ? (a.repair_bundles?.flat_rate ?? 0) : (a.items?.unit_cost ?? 0) * a.quantity,
          })),
        ]
    const lineItems = estimateRecord?.line_items?.length
      ? estimateRecord.line_items.map((item, index) => ({
          label: item.label,
          amount: index === 0 && !isNaN(parsedOverride) ? parsedOverride : item.amount,
        }))
      : fallbackLineItems

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxRate = job.locations?.tax_rate ?? 0
    const tax = Math.round(subtotal * taxRate * 100) / 100
    const total = Math.round((subtotal + tax) * 100) / 100

    return {
      primaryCharge: lineItems[0]?.amount ?? fallbackPrimaryCharge,
      addOnCharges: lineItems.slice(1).reduce((sum, item) => sum + item.amount, 0),
      lineItems,
      subtotal,
      taxRate,
      tax,
      total,
    }
  }, [flatRateStr, bundle, addOns, job.locations, job.diagnoses, adhocBundle, estimateRecord, invoiceSnapshot, hasVisitRepairs, visitRepairs])

  // ── Internal cost breakdown ──────────────────────────────────────────────

  const internalCost = useMemo(() => {
    const lines = bundle?.repair_bundle_lines ?? adhocBundle?.job_adhoc_bundle_lines ?? []
    return lines.reduce((sum, l) => {
      if (l.items?.type === 'profit') return sum
      if (l.items?.is_placeholder) {
        const actual = parseFloat(localCosts[l.items.id] ?? '')
        return sum + (isNaN(actual) ? 0 : actual) * l.quantity
      }
      const lockedUnitCost = l.cost_at_build ?? l.items?.unit_cost ?? 0
      return sum + lockedUnitCost * l.quantity
    }, 0)
  }, [adhocBundle, bundle, localCosts])

  const profit = invoiceCalc.primaryCharge - internalCost

  // ── Variance helpers ─────────────────────────────────────────────────────

  const varianceDiff = variance ? invoiceCalc.total - variance.avg : 0
  const variancePct = variance && variance.avg > 0 ? (varianceDiff / variance.avg) * 100 : 0
  const varianceNote = variance
    ? Math.abs(variancePct) < 15
      ? 'Within normal range — no action needed.'
      : variancePct > 0
        ? 'Above average — consider reviewing pricing.'
        : 'Below average — may need attention.'
    : ''

  // ── Save handlers ────────────────────────────────────────────────────────

  function handlePlaceholderSave(itemId: string, value: string) {
    setLocalCosts(prev => ({ ...prev, [itemId]: value }))
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed > 0) {
      startTransition(async () => {
        await savePlaceholderCost(job.id, itemId, parsed)
      })
    }
  }

  function handleAdminNotesBlur() {
    startTransition(async () => {
      await saveAdminNotes(job.id, adminNotes)
    })
  }

  function handleFlatRateBlur() {
    const parsed = parseFloat(flatRateStr)
    startTransition(async () => {
      await saveFlatRateOverride(job.id, isNaN(parsed) ? null : parsed)
    })
  }

  function handleFlag() {
    startTransition(async () => {
      await flagForReview(job.id, !job.flagged_for_review)
      router.refresh()
    })
  }

  function handleApproveConfirm() {
    startTransition(async () => {
      const result = await approveInvoice(job.id, { sendToEmail, ccEmail })
      if (result.success) {
        setShowConfirmModal(false)
        if ('warning' in result && result.warning) {
          alert(result.warning)
        }
        router.push('/invoices')
      } else {
        alert(result.error ?? 'Approval failed')
      }
    })
  }

  // ── Already invoiced guard ───────────────────────────────────────────────

  const isInvoiced = job.commercial_state === 'invoiced'
  const activePrimaryRepair = hasVisitRepairs ? 'visit' : bundle ? 'diagnosis' : adhocBundle ? 'adhoc' : 'none'
  const parsedManualPrice = parseFloat(flatRateStr)
  const diagnosisNeedsManualPrice = !!job.diagnosis_id && (!bundle || (bundle.flat_rate ?? 0) <= 0)
  const visitRepairNeedsManualPrice = hasVisitRepairs && visitRepairs.some(repair => (
    repair.variable_pricing || (repair.flat_rate_amount ?? 0) <= 0
  ))
  const requiresManualPrice = (
    activePrimaryRepair === 'adhoc'
    || visitRepairNeedsManualPrice
    || diagnosisNeedsManualPrice
  ) && (Number.isNaN(parsedManualPrice) || parsedManualPrice <= 0)

  // ── Photo total ──────────────────────────────────────────────────────────

  const totalPhotos = photoCounts.arrival + photoCounts.fault + photoCounts.post_repair

  // ── Tech name ────────────────────────────────────────────────────────────

  const techName = job.users
    ? `${job.users.first_name} ${job.users.last_name}`
    : '—'
  const visitRepairTitle = visitRepairs.length === 1
    ? (firstVisitRepair?.customer_description ?? firstVisitRepair?.repair_code ?? firstVisitRepair?.description_title)
    : hasVisitRepairs
      ? 'Completed HVAC repairs'
      : null
  const visitRepairBody = visitRepairs
    .map(repair => repair.description_body ?? repair.description_title)
    .filter(Boolean)
    .join('\n\n')
  const customerInvoiceTitle = estimateRecord?.customer_summary
    ?? visitRepairTitle
    ?? job.diagnoses?.invoice_description
    ?? job.diagnoses?.repair_code
    ?? (adhocBundle ? 'Ad-hoc repair service' : 'Service performed')
  const customerInvoiceBody = estimateRecord?.scope_of_work
    ?? (visitRepairBody || null)
    ?? job.diagnoses?.repair_notes
    ?? adhocBundle?.tech_description
    ?? ''

  // ── System summary ───────────────────────────────────────────────────────

  const systemSummary = job.systems
    ? [
        job.systems.make || job.systems.name,
        job.systems.system_subtype,
        job.systems.refrigerant_type,
        job.systems.metering_device,
      ].filter(Boolean).join(' · ')
    : '—'

  // ── Unit label ───────────────────────────────────────────────────────────

  const unitLabel = job.manual_unit ?? job.units?.name ?? '—'
  const repairSummary = hasVisitRepairs
    ? visitRepairs.map(repair => repair.repair_code ?? repair.description_title).join(', ')
    : (job.diagnoses?.repair_code ?? 'No diagnosis')

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '16px', maxWidth: '720px', margin: '0 auto' }}>

      {/* Back link */}
      <div style={{ marginBottom: '12px' }}>
        <span
          onClick={() => router.push('/invoices')}
          style={{ fontSize: '12px', color: '#185fa5', cursor: 'pointer' }}
        >
          ← Back to queue
        </span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700 }}>
          {job.customers?.name ?? '—'} — {job.locations?.name ?? '—'}
          {unitLabel !== '—' && ` · ${unitLabel}`}
        </div>
        <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>
          {repairSummary} - {techName}
          {isInvoiced && ` · ${job.invoice_number}`}
        </div>
      </div>

      {invoicePdfUrl && (
        <div style={{ marginBottom: '14px' }}>
          <a
            href={invoicePdfUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: '#185fa5', textDecoration: 'none', fontWeight: 600 }}
          >
            Open saved PDF
          </a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── 1. Blocker card (conditional) ──────────────────────────────── */}
        {!isInvoiced && placeholderItems.length > 0 && (
          <div style={{
            background: '#fcebeb',
            border: '1px solid #f7c1c1',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}>
            <div style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>⚠</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#a32d2d', marginBottom: '3px' }}>
                Cost entry required before approval
              </div>
              <div style={{ fontSize: '12px', color: '#712b13', lineHeight: 1.5 }}>
                This repair includes placeholder items with no stored cost. Enter actual costs below to calculate profit and unlock approval.
              </div>
              {placeholderItems.map(item => {
                const val = localCosts[item.id] ?? ''
                const filled = parseFloat(val) > 0
                return (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#fff',
                    border: `1px solid ${filled ? '#3b6d11' : '#f7c1c1'}`,
                    borderRadius: '7px',
                    padding: '8px 12px',
                    marginTop: '8px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: '#888780' }}>
                        Stored cost: ${item.unit_cost} — enter actual cost for this job
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="$0.00"
                      value={val}
                      onChange={e => setLocalCosts(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => handlePlaceholderSave(item.id, val)}
                      style={{
                        fontSize: '13px',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        border: `1px solid ${filled ? '#3b6d11' : '#d3d1c7'}`,
                        background: filled ? '#f4fbee' : '#fff',
                        fontFamily: 'inherit',
                        width: '110px',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 2. Variance card ──────────────────────────────────────────── */}
        <Card
          title="Price vs. diagnosis average"
          rightText={
            variance
              ? `${job.diagnoses?.repair_code ?? '—'} — ${variance.count} job${variance.count !== 1 ? 's' : ''} on record`
              : 'No historical data'
          }
        >
          {variance ? (
            <div style={{ background: '#f5f4f0', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>This invoice</div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{fmtMoney(invoiceCalc.total)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Running avg</div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{fmtMoney(variance.avg)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Variance</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: varianceDiff >= 0 ? '#3b6d11' : '#a32d2d' }}>
                    {varianceDiff >= 0 ? '+' : ''}{fmtMoney(varianceDiff)} ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(1)}%)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Range</div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    {fmtMoney(variance.min)} – {fmtMoney(variance.max)}
                  </div>
                </div>
              </div>
              {/* Range bar */}
              <div style={{ height: '8px', background: '#e2e1da', borderRadius: '4px', position: 'relative', marginBottom: '6px' }}>
                {(() => {
                  const range = variance.max - variance.min
                  if (range <= 0) return null
                  const avgPct = ((variance.avg - variance.min) / range) * 100
                  const thisPct = Math.max(0, Math.min(100, ((invoiceCalc.total - variance.min) / range) * 100))
                  return (
                    <>
                      <div style={{ position: 'absolute', left: `${avgPct}%`, top: '-3px', width: '2px', height: '14px', background: '#5f5e5a', borderRadius: '1px' }} />
                      <div style={{ position: 'absolute', left: `${thisPct}%`, top: '-4px', width: '10px', height: '10px', background: '#3b6d11', borderRadius: '50%', border: '2px solid #fff', marginLeft: '-5px' }} />
                    </>
                  )
                })()}
              </div>
              <div style={{ fontSize: '11px', color: '#5f5e5a' }}>{varianceNote}</div>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#888780' }}>
              No invoiced jobs found for this diagnosis code. This will be the first.
            </div>
          )}
        </Card>

        {/* ── 3. Job summary ────────────────────────────────────────────── */}
        {(estimateRecord || partsRequest) && (
          <Card
            title="Commercial path"
            rightText={estimateRecord?.estimate_number ?? 'Same-job follow-up'}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Estimate</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {estimateRecord?.status ?? 'No estimate record'}
                </div>
                <div style={{ fontSize: '11px', color: '#5f5e5a', marginTop: '3px' }}>
                  {estimateRecord?.approved_at ? `Approved ${fmtDate(estimateRecord.approved_at)}` : (estimateRecord?.sent_at ? `Sent ${fmtDate(estimateRecord.sent_at)}` : '')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Quoted total</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {estimateRecord ? fmtMoney(estimateRecord.total) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Parts vendor</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {partsRequest?.vendor_name ?? 'No vendor logged'}
                </div>
                <div style={{ fontSize: '11px', color: '#5f5e5a', marginTop: '3px' }}>
                  {partsRequest?.ordered_at ? `Ordered ${fmtDate(partsRequest.ordered_at)}` : (partsRequest?.vendor_email_sent_at ? `Requested ${fmtDate(partsRequest.vendor_email_sent_at)}` : '')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Parts lines</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {partsRequest?.job_parts_request_lines?.length ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: '#5f5e5a', marginTop: '3px' }}>
                  {partsRequest?.ready_to_schedule_at ? `Ready ${fmtDate(partsRequest.ready_to_schedule_at)}` : ''}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6, marginTop: '12px' }}>
              Final invoice review is using the same job record that carried the estimate, parts sourcing, and return visit. The customer-facing summary below will prefer the saved estimate scope when one exists.
            </div>
          </Card>
        )}

        <Card
          title="Job summary"
          rightText={`Completed ${relativeTime(job.completed_at)}`}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Customer</div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{job.customers?.name ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Unit</div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{unitLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>System</div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{systemSummary}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Tech</div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{techName}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>On site</div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{durationStr(job.arrived_at, job.completed_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Photos</div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>
                {totalPhotos > 0
                  ? `${totalPhotos} (${photoCounts.arrival} arrival · ${photoCounts.fault} fault · ${photoCounts.post_repair} post)`
                  : 'None'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' }}>Source</div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{job.how_it_came_in ?? '—'}</div>
            </div>
          </div>
        </Card>

        {/* ── 4. Field observations ─────────────────────────────────────── */}
        <Card title="Field observations">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              { label: 'Outdoor', val: job.temp_outdoor },
              { label: 'Return air', val: job.temp_return },
              { label: 'Supply air', val: job.temp_supply },
            ].map(t => (
              <div key={t.label} style={{ background: '#f5f4f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '3px' }}>
                  {t.label}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{t.val ?? '—'}</div>
                <div style={{ fontSize: '10px', color: '#888780' }}>°F</div>
              </div>
            ))}
          </div>
          {/* Delta-T */}
          {job.temp_return != null && job.temp_supply != null && (
            <div style={{
              background: '#eaf3de',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}>
              <div style={{ fontSize: '12px', color: '#3b6d11', fontWeight: 500 }}>Delta-T (return − supply)</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#3b6d11' }}>
                {job.temp_return - job.temp_supply}°F
              </div>
            </div>
          )}
          {/* Chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {job.tstat_mode && (
              <div style={{ fontSize: '12px', background: '#f5f4f0', borderRadius: '6px', padding: '5px 12px' }}>
                <span style={{ color: '#888780', marginRight: '4px', fontSize: '11px' }}>Mode</span>
                {job.tstat_mode}
              </div>
            )}
            {job.tstat_fan && (
              <div style={{ fontSize: '12px', background: '#f5f4f0', borderRadius: '6px', padding: '5px 12px' }}>
                <span style={{ color: '#888780', marginRight: '4px', fontSize: '11px' }}>Fan</span>
                {job.tstat_fan}
              </div>
            )}
            {job.system_response && (
              <div style={{ fontSize: '12px', background: '#f5f4f0', borderRadius: '6px', padding: '5px 12px' }}>
                <span style={{ color: '#888780', marginRight: '4px', fontSize: '11px' }}>Response</span>
                {job.system_response}
              </div>
            )}
          </div>
        </Card>

        {/* ── 5. Diagnosis & repair bundle ──────────────────────────────── */}
        <Card title={activePrimaryRepair === 'visit' ? 'Selected visit repairs' : activePrimaryRepair === 'adhoc' ? 'Ad-hoc repair review' : 'Diagnosis & repair bundle'}>
          {hasVisitRepairs && (
            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
              {visitRepairs.map(repair => (
                <div key={repair.id} style={{ background: '#f5f4f0', borderRadius: '8px', padding: '12px 14px', border: '1px solid #e2e1da' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>
                      {repair.repair_code ?? repair.description_title}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {repair.flat_rate_amount != null && repair.flat_rate_amount > 0
                        ? fmtMoney(Number(repair.flat_rate_amount) * Number(repair.quantity ?? 1))
                        : 'Price review needed'}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.5 }}>
                    {repair.customer_description ?? repair.description_title}
                  </div>
                  {repair.variable_pricing && (
                    <div style={{ fontSize: '11px', color: '#854f0b', marginTop: '5px', fontWeight: 700 }}>
                      Variable pricing - owner override required before approval.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Diagnosis block */}
          {!hasVisitRepairs && job.diagnoses ? (
            <div style={{ background: '#f5f4f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#888780', marginBottom: '3px' }}>
                {job.diagnoses.repair_code}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '5px' }}>
                {job.diagnoses.invoice_description ?? job.diagnoses.repair_code}
              </div>
              {job.diagnoses.repair_notes && (
                <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.5, fontStyle: 'italic' }}>
                  {job.diagnoses.repair_notes}
                </div>
              )}
            </div>
          ) : !hasVisitRepairs && adhocBundle ? (
            <div style={{ background: '#fdf7ea', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px', border: '1px solid #ecd8ad' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#854f0b', marginBottom: '3px' }}>
                Ad-hoc repair
              </div>
              <div style={{ fontSize: '13px', color: '#4f3b14', lineHeight: 1.6 }}>
                {adhocBundle.tech_description}
              </div>
            </div>
          ) : !hasVisitRepairs ? (
            <div style={{ fontSize: '12px', color: '#888780', marginBottom: '12px' }}>No diagnosis or ad-hoc repair set</div>
          ) : null}

          {/* Internal banner */}
          {(bundle || adhocBundle) && (
            <>
              <div style={{
                fontSize: '11px',
                background: '#eeedfe',
                color: '#3c3489',
                borderRadius: '5px',
                padding: '3px 10px',
                fontWeight: 600,
                display: 'inline-block',
                marginBottom: '10px',
              }}>
                Internal - not shown on customer invoice
              </div>

              {/* Itemized cost table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Item', 'Type', 'Qty', 'Unit cost', 'Total'].map((h, i) => (
                      <th key={h} style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '.05em',
                        color: '#888780',
                        textAlign: i >= 2 ? 'right' : 'left',
                        padding: '5px 8px',
                        borderBottom: '1px solid #e2e1da',
                        fontWeight: 600,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(bundle?.repair_bundle_lines ?? adhocBundle?.job_adhoc_bundle_lines ?? []).map(line => {
                    const item = line.items
                    if (!item || item.type === 'profit') return null
                    const unitCost = item.is_placeholder
                      ? parseFloat(localCosts[item.id] ?? '') || item.unit_cost
                      : (line.cost_at_build ?? item.unit_cost)
                    const lineTotal = unitCost * line.quantity
                    return (
                      <tr key={line.id}>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9' }}>
                          {item.name}
                          {item.is_placeholder && <span style={{ color: '#a32d2d', fontSize: '10px', marginLeft: '4px' }}>●</span>}
                        </td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', fontSize: '11px', color: '#888780' }}>
                          {item.type}
                        </td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', textAlign: 'right' }}>
                          {line.quantity} {item.unit}
                        </td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtMoney(unitCost)}
                        </td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtMoney(lineTotal)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Profit row */}
                  <tr>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', color: '#3b6d11', fontWeight: 600 }}>Profit</td>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', fontSize: '11px', color: '#3b6d11' }}>Profit</td>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', textAlign: 'right', color: '#3b6d11' }}>—</td>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', textAlign: 'right', color: '#3b6d11' }}>—</td>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', textAlign: 'right', fontWeight: 600, color: '#3b6d11', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(profit)}
                    </td>
                  </tr>
                  {/* Flat rate total */}
                  <tr>
                    <td colSpan={4} style={{ padding: '10px 8px 7px', borderTop: '2px solid #e2e1da', fontWeight: 700, fontSize: '14px' }}>
                      {activePrimaryRepair === 'adhoc' ? 'Owner-set flat rate' : 'Flat rate total'}
                    </td>
                    <td style={{ padding: '10px 8px 7px', borderTop: '2px solid #e2e1da', textAlign: 'right', fontWeight: 700, fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(invoiceCalc.primaryCharge)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Add-ons table */}
          {addOns.length > 0 && (
            <div style={{ marginTop: '14px', borderTop: '1px solid #e2e1da', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>
                Add-ons
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Item / Bundle', 'Type', 'Qty', 'Cost'].map((h, i) => (
                      <th key={h} style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '.05em',
                        color: '#888780',
                        textAlign: i >= 2 ? 'right' : 'left',
                        padding: '5px 8px',
                        borderBottom: '1px solid #e2e1da',
                        fontWeight: 600,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {addOns.map(a => (
                    <tr key={a.id}>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', color: '#185fa5' }}>
                        {a.type === 'bundle' ? a.repair_bundles?.name : a.items?.name}
                      </td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', fontSize: '11px', color: '#888780' }}>
                        {a.type === 'bundle' ? 'Bundle' : 'À la carte'}
                      </td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', textAlign: 'right' }}>
                        {a.quantity}
                      </td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0efe9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(a.type === 'bundle' ? (a.repair_bundles?.flat_rate ?? 0) : (a.items?.unit_cost ?? 0) * a.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Flat rate override input */}
          {!isInvoiced && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid #e2e1da',
              flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: '13px', color: '#5f5e5a' }}>Override flat rate:</div>
              <input
                type="text"
                value={flatRateStr}
                onChange={e => setFlatRateStr(e.target.value)}
                onBlur={handleFlatRateBlur}
                style={{
                  fontSize: '13px',
                  padding: '5px 10px',
                  borderRadius: '5px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  width: '100px',
                  textAlign: 'right',
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: '11px', color: '#888780' }}>
                {activePrimaryRepair === 'visit'
                  ? visitRepairNeedsManualPrice
                    ? 'Required because one selected visit repair is variable or missing a flat rate'
                    : 'Adjust selected visit repair pricing before finalizing if needed'
                  : activePrimaryRepair === 'adhoc'
                  ? 'Required for ad-hoc repairs before finalizing'
                  : diagnosisNeedsManualPrice
                    ? 'Required because this diagnosis does not have a priced catalog bundle yet'
                    : 'Adjust before finalizing if needed'}
              </div>
            </div>
          )}
        </Card>

        {/* ── 6. Bill to ────────────────────────────────────────────────── */}
        <Card
          title="Bill to"
          rightText="Set on customer record — applies to all invoices"
        >
          <div style={{
            background: '#f5f4f0',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                {parentCustomer
                  ? <>{parentCustomer.name} <span style={{ fontSize: '11px', fontWeight: 400, color: '#888780' }}>(parent account)</span></>
                  : job.customers?.name ?? '—'
                }
              </div>
              <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6 }}>
                {billToCustomer?.billing_email ?? 'No billing email on file'}
                {parentCustomer && (
                  <> · Receives all {job.customers?.name} invoices per account setup</>
                )}
              </div>
            </div>
            {job.customers && (
              <div
                onClick={() => window.open(`/customers/${job.customer_id}`, '_blank')}
                style={{ fontSize: '11px', color: '#185fa5', cursor: 'pointer', whiteSpace: 'nowrap', marginTop: '2px' }}
              >
                Change in customer settings →
              </div>
            )}
          </div>
        </Card>

        {/* ── 7. Customer invoice preview ───────────────────────────────── */}
        <Card
          title="Customer invoice preview"
          rightText=""
        >
          <div style={{
            background: '#fff',
            border: '1px solid #e2e1da',
            borderRadius: '8px',
            padding: '18px 22px',
          }}>
            {/* From / To */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '14px',
              paddingBottom: '14px',
              borderBottom: '1px solid #e2e1da',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6 }}>
                <strong style={{ fontSize: '15px', display: 'block', marginBottom: '3px', color: '#1a1a18' }}>LSP HVAC Services</strong>
                Greensboro, NC
              </div>
              <div style={{ fontSize: '12px', color: '#5f5e5a', textAlign: 'right', lineHeight: 1.6 }}>
                <strong style={{ fontSize: '13px', color: '#1a1a18', display: 'block', marginBottom: '2px' }}>
                  {parentCustomer?.name ?? job.customers?.name ?? '—'}
                </strong>
                {parentCustomer && <>c/o {job.customers?.name}<br /></>}
                {billToCustomer?.billing_email ?? ''}
              </div>
            </div>

            {/* Invoice meta */}
            <div style={{
              display: 'flex',
              gap: '24px',
              marginBottom: '14px',
              paddingBottom: '14px',
              borderBottom: '1px solid #e2e1da',
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '2px' }}>Invoice #</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{job.invoice_number ?? 'Pending'}</div>
              </div>
              {estimateRecord?.estimate_number && (
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '2px' }}>Estimate ref</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{estimateRecord.estimate_number}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '2px' }}>Service date</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{fmtDate(job.job_date)}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '2px' }}>Unit</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{unitLabel}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '2px' }}>Tech</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{techName}</div>
              </div>
            </div>

            {/* Description */}
            <div style={{
              fontSize: '13px',
              lineHeight: 1.75,
              marginBottom: '14px',
              paddingBottom: '14px',
              borderBottom: '1px solid #e2e1da',
            }}>
              <strong style={{ display: 'block', marginBottom: '6px' }}>
                {customerInvoiceTitle}
              </strong>
              {customerInvoiceBody}
            </div>

            <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #e2e1da' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '8px' }}>Charges</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {invoiceCalc.lineItems.map(item => (
                  <div key={`${item.label}-${item.amount}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
                    <div style={{ color: '#1a1a18' }}>{item.label}</div>
                    <div style={{ color: '#1a1a18', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(item.amount)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total + tax */}
            <div>
              {invoiceCalc.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#888780' }}>Subtotal</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{fmtMoney(invoiceCalc.subtotal)}</div>
                </div>
              )}
              {invoiceCalc.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#888780' }}>Tax ({(invoiceCalc.taxRate * 100).toFixed(2)}%)</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{fmtMoney(invoiceCalc.tax)}</div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px' }}>
                <div style={{ fontSize: '13px', color: '#888780' }}>Total due</div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{fmtMoney(invoiceCalc.total)}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#b4b2a9', textAlign: 'right', marginTop: '4px', fontStyle: 'italic' }}>
                Payment due net 30 · No itemized breakdown per service agreement
              </div>
            </div>
          </div>
        </Card>

        {/* ── 8. Admin notes ─────────────────────────────────────────────── */}
        <Card title="Admin notes">
          <textarea
            rows={3}
            placeholder="Internal notes — not shown on invoice…"
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            onBlur={handleAdminNotesBlur}
            style={{
              width: '100%',
              fontSize: '13px',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #d3d1c7',
              background: '#f5f4f0',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.6,
              boxSizing: 'border-box',
            }}
          />
        </Card>

        {/* ── 9. Action bar ──────────────────────────────────────────────── */}
        {!isInvoiced && (
          <div style={{
            background: '#fff',
            border: '1px solid #e2e1da',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: '12px', color: '#888780', lineHeight: 1.5 }}>
              {hasUnfilledPlaceholders
                ? 'Enter placeholder costs above before approving.'
                : requiresManualPrice
                  ? activePrimaryRepair === 'visit'
                    ? 'Enter a flat-rate override before approving this variable or unpriced visit repair.'
                    : activePrimaryRepair === 'adhoc'
                    ? 'Enter the owner-set flat rate before approving this ad-hoc repair.'
                    : 'Enter a flat-rate override before approving. This diagnosis does not currently resolve to a priced repair bundle.'
                : `Approving will finalize this invoice for ${sendToEmail || 'the billing address'}. A PDF will be saved and emailed automatically.`
              }
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleFlag}
                disabled={isPending}
                style={{
                  fontSize: '13px',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: '1px solid #f7c1c1',
                  background: job.flagged_for_review ? '#f7c1c1' : '#fcebeb',
                  color: '#a32d2d',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {job.flagged_for_review ? 'Remove flag' : 'Flag for follow-up'}
              </button>
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={hasUnfilledPlaceholders || requiresManualPrice || isPending}
                style={{
                  fontSize: '13px',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: '1px solid #3b6d11',
                  background: (hasUnfilledPlaceholders || requiresManualPrice) ? '#b4b2a9' : '#3b6d11',
                  color: '#fff',
                  cursor: (hasUnfilledPlaceholders || requiresManualPrice) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Approve & finalize
              </button>
            </div>
          </div>
        )}

        {/* Already invoiced banner */}
        {isInvoiced && (
          <div style={{
            background: '#f1efe8',
            border: '1px solid #e2e1da',
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: '13px',
            color: '#5f5e5a',
            textAlign: 'center',
          }}>
            ✓ Invoice {job.invoice_number} approved {job.approved_at ? `on ${fmtDate(job.approved_at)}` : ''}
          </div>
        )}
      </div>

      {/* ── Confirmation modal ──────────────────────────────────────────── */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '24px',
              width: '440px',
              maxWidth: '90vw',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
              Confirm & send invoice
            </div>
            <div style={{ fontSize: '12px', color: '#888780', marginBottom: '16px', lineHeight: 1.5 }}>
              {activePrimaryRepair === 'adhoc'
                ? 'This ad-hoc repair will use the owner-set flat rate. Approval finalizes the invoice, saves the PDF, and sends it automatically.'
                : activePrimaryRepair === 'visit'
                  ? 'Approval will use the selected visit repair snapshot, save the PDF, and send it automatically.'
                  : 'Approval finalizes the invoice, saves the PDF, and sends it automatically.'}
            </div>

            {/* Send to */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Send to
              </label>
              <input
                type="text"
                value={sendToEmail}
                onChange={e => setSendToEmail(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '8px 12px',
                  borderRadius: '7px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* CC */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                CC (optional)
              </label>
              <input
                type="text"
                value={ccEmail}
                onChange={e => setCcEmail(e.target.value)}
                placeholder="e.g. manager@example.com"
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '8px 12px',
                  borderRadius: '7px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Total */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Invoice total
              </label>
              <input
                type="text"
                value={fmtMoney(invoiceCalc.total)}
                readOnly
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '8px 12px',
                  borderRadius: '7px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: '#f5f4f0',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  fontSize: '13px',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: '1px solid #d3d1c7',
                  background: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApproveConfirm}
                disabled={isPending}
                style={{
                  fontSize: '13px',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: '1px solid #3b6d11',
                  background: '#3b6d11',
                  color: '#fff',
                  cursor: isPending ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {isPending ? 'Sending…' : 'Send invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
