'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getCommercialStateMeta } from '@/utils/job-lifecycle'
import {
  EstimateAddOn,
  EstimateAdhocBundle,
  EstimateJob,
  EstimateRecord,
  EstimateRepairBundle,
  EstimateTech,
  ParentCustomer,
  PartsRequest,
} from '../types'
import {
  generateEstimatePdf,
  markEstimateApproved,
  markPartsOrdered,
  markReadyToSchedule,
  markEstimateSent,
  saveEstimateDraft,
  savePartsDraft,
  scheduleFollowUp,
  sendPartsVendorEmailAction,
} from './actions'

interface Props {
  job: EstimateJob
  bundle: EstimateRepairBundle | null
  adhocBundle: EstimateAdhocBundle | null
  addOns: EstimateAddOn[]
  estimate: EstimateRecord | null
  partsRequest: PartsRequest | null
  parentCustomer: ParentCustomer | null
  estimatePdfUrl: string | null
  techs: EstimateTech[]
  assignedTechId: string | null
  assistTechIds: string[]
}

type EditablePartsLine = {
  id?: string | null
  partName: string
  partNumber: string
  quantity: string
  unitCost: string
  notes: string
  ordered: boolean
}

function fmtMoney(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function Card({ title, children, rightText }: { title: string; children: React.ReactNode; rightText?: string }) {
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
        {rightText && <div style={{ fontSize: '11px', color: '#888780' }}>{rightText}</div>}
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

export default function EstimateDetail({
  job,
  bundle,
  adhocBundle,
  addOns,
  estimate,
  partsRequest,
  parentCustomer,
  estimatePdfUrl,
  techs,
  assignedTechId,
  assistTechIds,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const billTo = parentCustomer ?? job.customers
  const [customerSummary, setCustomerSummary] = useState(
    estimate?.customer_summary
    ?? job.diagnoses?.invoice_description
    ?? job.diagnoses?.repair_code
    ?? 'Repair recommendation',
  )
  const [scopeOfWork, setScopeOfWork] = useState(
    estimate?.scope_of_work
    ?? job.diagnoses?.repair_notes
    ?? bundle?.repair_notes
    ?? adhocBundle?.tech_description
    ?? job.problem_description
    ?? '',
  )
  const [sendToEmail, setSendToEmail] = useState(estimate?.send_to_email ?? billTo?.billing_email ?? '')
  const [ccEmail, setCcEmail] = useState(estimate?.cc_email ?? '')
  const [flatRateStr, setFlatRateStr] = useState(
    String(job.flat_rate_override ?? estimate?.line_items?.[0]?.amount ?? bundle?.flat_rate ?? ''),
  )
  const [vendorName, setVendorName] = useState(partsRequest?.vendor_name ?? '')
  const [vendorEmail, setVendorEmail] = useState(partsRequest?.vendor_email ?? '')
  const [etaDate, setEtaDate] = useState(partsRequest?.eta_date ?? '')
  const [vendorNotes, setVendorNotes] = useState(partsRequest?.vendor_notes ?? '')
  const [vendorEmailSubject, setVendorEmailSubject] = useState(partsRequest?.email_subject ?? '')
  const [vendorEmailBody, setVendorEmailBody] = useState(partsRequest?.email_body ?? '')
  const [followUpDate, setFollowUpDate] = useState(job.job_status === 'follow_up_scheduled' ? job.job_date : '')
  const [followUpAssignedTechId, setFollowUpAssignedTechId] = useState(assignedTechId ?? '')
  const [followUpAssistTechIds, setFollowUpAssistTechIds] = useState<string[]>(
    assistTechIds.filter(techId => techId !== assignedTechId),
  )
  const [partsLines, setPartsLines] = useState<EditablePartsLine[]>(
    partsRequest?.job_parts_request_lines?.length
      ? partsRequest.job_parts_request_lines
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(line => ({
            id: line.id,
            partName: line.part_name,
            partNumber: line.part_number ?? '',
            quantity: String(line.quantity),
            unitCost: line.unit_cost != null ? String(line.unit_cost) : '',
            notes: line.notes ?? '',
            ordered: line.ordered,
          }))
      : [{ partName: '', partNumber: '', quantity: '1', unitCost: '', notes: '', ordered: false }],
  )

  const stateMeta = getCommercialStateMeta(job.commercial_state)
  const hasSavedEstimate = !!estimate
  const hasPdf = !!estimate?.pdf_path
  const partsSectionEnabled = ['approved', 'parts_needed', 'parts_ordered', 'ready_to_schedule'].includes(job.commercial_state)
  const partsActionsEnabled = partsSectionEnabled && hasSavedEstimate
  const followUpSchedulingEnabled = job.commercial_state === 'ready_to_schedule'

  const estimateCalc = useMemo(() => {
    const parsedPrimary = parseFloat(flatRateStr)
    const primaryAmount = Number.isFinite(parsedPrimary) ? parsedPrimary : 0
    const primaryLabel = job.diagnoses?.repair_code ?? bundle?.name ?? 'Repair estimate'
    const lineItems = [
      { label: primaryLabel, amount: primaryAmount },
      ...addOns.map(addOn => ({
        label: addOn.type === 'bundle' ? (addOn.repair_bundles?.name ?? 'Additional bundle') : (addOn.items?.name ?? 'Additional item'),
        amount: addOn.type === 'bundle'
          ? (addOn.repair_bundles?.flat_rate ?? 0)
          : (addOn.items?.unit_cost ?? 0) * addOn.quantity,
      })),
    ]
    const subtotal = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100
    const taxRate = job.locations?.tax_rate ?? 0
    const tax = Math.round(subtotal * taxRate * 100) / 100
    const total = Math.round((subtotal + tax) * 100) / 100

    return {
      primaryAmount,
      lineItems,
      subtotal,
      taxRate,
      tax,
      total,
    }
  }, [addOns, bundle, flatRateStr, job.diagnoses?.repair_code, job.locations?.tax_rate])

  function buildInput() {
    const parsedPrimary = parseFloat(flatRateStr)
    return {
      customerSummary,
      scopeOfWork,
      sendToEmail,
      ccEmail,
      primaryAmount: Number.isFinite(parsedPrimary) ? parsedPrimary : null,
    }
  }

  function buildPartsInput() {
    return {
      vendorName,
      vendorEmail,
      etaDate,
      vendorNotes,
      emailSubject: vendorEmailSubject,
      emailBody: vendorEmailBody,
      lines: partsLines.map(line => ({
        id: line.id ?? null,
        partName: line.partName,
        partNumber: line.partNumber,
        quantity: line.quantity.trim() ? parseFloat(line.quantity) : null,
        unitCost: line.unitCost.trim() ? parseFloat(line.unitCost) : null,
        notes: line.notes,
        ordered: line.ordered,
      })),
    }
  }

  function buildFollowUpInput() {
    return {
      scheduledDate: followUpDate,
      assignedTechId: followUpAssignedTechId,
      assistTechIds: followUpAssistTechIds,
    }
  }

  function runTask(task: () => Promise<{ error?: string | null; success?: boolean }>, onSuccess?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await task()
      if (result.error) {
        setError(result.error)
        return
      }
      onSuccess?.()
      router.refresh()
    })
  }

  const unitLabel = job.manual_unit ?? job.units?.name ?? '-'
  const techName = job.users ? `${job.users.first_name} ${job.users.last_name}` : '-'
  const systemSummary = job.systems
    ? [job.systems.make || job.systems.name, job.systems.system_subtype, job.systems.refrigerant_type].filter(Boolean).join(' - ')
    : '-'
  const hasMeaningfulPartsLines = partsLines.some(line => line.partName.trim() && parseFloat(line.quantity) > 0)
  const partsMaterialTotal = partsLines.reduce((sum, line) => {
    const quantity = parseFloat(line.quantity)
    const unitCost = parseFloat(line.unitCost)
    if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) return sum
    return sum + quantity * unitCost
  }, 0)

  function updatePartLine(index: number, patch: Partial<EditablePartsLine>) {
    setPartsLines(current => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...patch } : line))
  }

  function addPartLine() {
    setPartsLines(current => [...current, { partName: '', partNumber: '', quantity: '1', unitCost: '', notes: '', ordered: false }])
  }

  function removePartLine(index: number) {
    setPartsLines(current => {
      if (current.length === 1) {
        return [{ partName: '', partNumber: '', quantity: '1', unitCost: '', notes: '', ordered: false }]
      }
      return current.filter((_, currentIndex) => currentIndex !== index)
    })
  }

  function toggleAssistTech(techId: string) {
    setFollowUpAssistTechIds(currentIds => (
      currentIds.includes(techId)
        ? currentIds.filter(id => id !== techId)
        : [...currentIds, techId]
    ))
  }

  const selectedLeadTech = techs.find(tech => tech.id === followUpAssignedTechId) ?? null
  const selectedAssistTechs = followUpAssistTechIds
    .map(techId => techs.find(tech => tech.id === techId) ?? null)
    .filter((tech): tech is EstimateTech => !!tech)

  return (
    <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => router.push('/estimates')}
          style={{ fontSize: '12px', color: '#185fa5', cursor: 'pointer', border: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit' }}
        >
          {'<- Back to estimates'}
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a18' }}>
              {job.customers?.name ?? '-'} - {job.locations?.name ?? '-'}
              {unitLabel !== '-' ? ` - ${unitLabel}` : ''}
            </div>
            <div style={{ fontSize: '11px', color: '#5f5e5a', marginTop: '2px', lineHeight: 1.5 }}>
              {job.diagnoses?.repair_code ?? 'Repair estimate'} - {techName} - {fmtDate(job.job_date)}
              <br />
              {systemSummary}
            </div>
          </div>
          {stateMeta && (
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '999px',
              padding: '5px 10px',
              background: stateMeta.bg,
              color: stateMeta.fg,
            }}>
              {stateMeta.label}
            </span>
          )}
        </div>
      </div>

      {estimatePdfUrl && (
        <div style={{ marginBottom: '14px' }}>
          <a
            href={estimatePdfUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: '#185fa5', textDecoration: 'none', fontWeight: 600 }}
          >
            Open saved estimate PDF
          </a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Card title="Estimate Status" rightText={estimate?.estimate_number ?? 'No estimate number yet'}>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '3px' }}>Current state</div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{stateMeta?.label ?? 'estimate needed'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '3px' }}>Generated</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{fmtDate(estimate?.generated_at ?? null)}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '3px' }}>Sent</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{fmtDate(estimate?.sent_at ?? null)}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#888780', marginBottom: '3px' }}>Approved</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{fmtDate(estimate?.approved_at ?? null)}</div>
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6 }}>
            This screen keeps the estimate attached to the original job so the next lifecycle slices can carry parts sourcing and follow-up scheduling forward without creating a second job record.
          </div>
        </Card>

        <Card title="Customer Summary">
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Estimate headline
              </label>
              <input
                type="text"
                value={customerSummary}
                onChange={event => setCustomerSummary(event.target.value)}
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Scope of work
              </label>
              <textarea
                rows={6}
                value={scopeOfWork}
                onChange={event => setScopeOfWork(event.target.value)}
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  lineHeight: 1.6,
                }}
              />
            </div>
          </div>
        </Card>

        <Card title="Pricing" rightText={billTo?.name ?? job.customers?.name ?? 'Customer'}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              Quoted repair amount
            </label>
            <input
              type="text"
              value={flatRateStr}
              onChange={event => setFlatRateStr(event.target.value)}
              style={{
                width: '140px',
                fontSize: '13px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d3d1c7',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                textAlign: 'right',
              }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0 0 8px', color: '#888780', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Line item</th>
                  <th style={{ textAlign: 'right', padding: '0 0 8px', color: '#888780', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {estimateCalc.lineItems.map(item => (
                  <tr key={item.label}>
                    <td style={{ padding: '8px 0', borderTop: '1px solid #f0efe9', color: '#1a1a18' }}>{item.label}</td>
                    <td style={{ padding: '8px 0', borderTop: '1px solid #f0efe9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(item.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '10px 0 4px', color: '#5f5e5a' }}>Subtotal</td>
                  <td style={{ padding: '10px 0 4px', textAlign: 'right' }}>{fmtMoney(estimateCalc.subtotal)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', color: '#5f5e5a' }}>Tax ({(estimateCalc.taxRate * 100).toFixed(2)}%)</td>
                  <td style={{ padding: '4px 0', textAlign: 'right' }}>{fmtMoney(estimateCalc.tax)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0 0', fontSize: '15px', fontWeight: 700 }}>Estimated total</td>
                  <td style={{ padding: '8px 0 0', textAlign: 'right', fontSize: '18px', fontWeight: 700 }}>{fmtMoney(estimateCalc.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Delivery">
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Send to
              </label>
              <input
                type="text"
                value={sendToEmail}
                onChange={event => setSendToEmail(event.target.value)}
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                CC
              </label>
              <input
                type="text"
                value={ccEmail}
                onChange={event => setCcEmail(event.target.value)}
                placeholder="Optional"
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6 }}>
            This first pass saves the PDF and tracks send/approval state inside the job. Customer email automation can plug into this data in the next lifecycle slices.
          </div>
        </Card>

        <Card title="Parts Sourcing" rightText={partsRequest?.vendor_name ?? 'No vendor selected'}>
          {!partsSectionEnabled && (
            <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6 }}>
              Approve the estimate first, then continue the same job into parts sourcing, vendor outreach, and ready-to-schedule tracking from here.
            </div>
          )}

          {partsSectionEnabled && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Vendor
                  </label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={event => setVendorName(event.target.value)}
                    style={{
                      width: '100%',
                      fontSize: '13px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d3d1c7',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Vendor email
                  </label>
                  <input
                    type="text"
                    value={vendorEmail}
                    onChange={event => setVendorEmail(event.target.value)}
                    style={{
                      width: '100%',
                      fontSize: '13px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d3d1c7',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    ETA
                  </label>
                  <input
                    type="date"
                    value={etaDate}
                    onChange={event => setEtaDate(event.target.value)}
                    style={{
                      width: '100%',
                      fontSize: '13px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d3d1c7',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Vendor notes
                </label>
                <textarea
                  rows={3}
                  value={vendorNotes}
                  onChange={event => setVendorNotes(event.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '13px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d3d1c7',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    lineHeight: 1.6,
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#5f5e5a' }}>Needed parts</div>
                  <div style={{ fontSize: '11px', color: '#888780' }}>Material subtotal {fmtMoney(partsMaterialTotal)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {partsLines.map((line, index) => (
                    <div key={line.id ?? `line-${index}`} style={{ border: '1px solid #ece8de', borderRadius: '10px', padding: '12px', background: line.ordered ? '#f4fbef' : '#fcfbf8' }}>
                      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'minmax(180px, 2fr) minmax(140px, 1fr) 90px 110px auto', alignItems: 'end' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888780', display: 'block', marginBottom: '4px' }}>Part</label>
                          <input
                            type="text"
                            value={line.partName}
                            onChange={event => updatePartLine(index, { partName: event.target.value })}
                            style={{ width: '100%', fontSize: '13px', padding: '9px 10px', borderRadius: '8px', border: '1px solid #d3d1c7', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888780', display: 'block', marginBottom: '4px' }}>Part number</label>
                          <input
                            type="text"
                            value={line.partNumber}
                            onChange={event => updatePartLine(index, { partNumber: event.target.value })}
                            style={{ width: '100%', fontSize: '13px', padding: '9px 10px', borderRadius: '8px', border: '1px solid #d3d1c7', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888780', display: 'block', marginBottom: '4px' }}>Qty</label>
                          <input
                            type="text"
                            value={line.quantity}
                            onChange={event => updatePartLine(index, { quantity: event.target.value })}
                            style={{ width: '100%', fontSize: '13px', padding: '9px 10px', borderRadius: '8px', border: '1px solid #d3d1c7', fontFamily: 'inherit', boxSizing: 'border-box', textAlign: 'right' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888780', display: 'block', marginBottom: '4px' }}>Unit cost</label>
                          <input
                            type="text"
                            value={line.unitCost}
                            onChange={event => updatePartLine(index, { unitCost: event.target.value })}
                            style={{ width: '100%', fontSize: '13px', padding: '9px 10px', borderRadius: '8px', border: '1px solid #d3d1c7', fontFamily: 'inherit', boxSizing: 'border-box', textAlign: 'right' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#31590f', whiteSpace: 'nowrap' }}>
                            <input
                              type="checkbox"
                              checked={line.ordered}
                              onChange={event => updatePartLine(index, { ordered: event.target.checked })}
                            />
                            Ordered
                          </label>
                          <button
                            type="button"
                            onClick={() => removePartLine(index)}
                            style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d3d1c7', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '11px', color: '#888780', display: 'block', marginBottom: '4px' }}>Notes</label>
                        <input
                          type="text"
                          value={line.notes}
                          onChange={event => updatePartLine(index, { notes: event.target.value })}
                          style={{ width: '100%', fontSize: '13px', padding: '9px 10px', borderRadius: '8px', border: '1px solid #d3d1c7', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addPartLine}
                  style={{ marginTop: '10px', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d3d1c7', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Add part line
                </button>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Vendor email subject
                </label>
                <input
                  type="text"
                  value={vendorEmailSubject}
                  onChange={event => setVendorEmailSubject(event.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '13px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d3d1c7',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Vendor email body
                </label>
                <textarea
                  rows={8}
                  value={vendorEmailBody}
                  onChange={event => setVendorEmailBody(event.target.value)}
                  placeholder="Leave blank to use the default vendor parts request message."
                  style={{
                    width: '100%',
                    fontSize: '13px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d3d1c7',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    lineHeight: 1.6,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => runTask(() => savePartsDraft(job.id, buildPartsInput()))}
                  disabled={isPending || !partsActionsEnabled || !hasMeaningfulPartsLines}
                  style={{
                    fontSize: '13px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #d3d1c7',
                    background: '#fff',
                    cursor: (isPending || !partsActionsEnabled || !hasMeaningfulPartsLines) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Save parts draft
                </button>
                <button
                  type="button"
                  onClick={() => runTask(() => sendPartsVendorEmailAction(job.id, buildPartsInput()))}
                  disabled={isPending || !partsActionsEnabled || !hasMeaningfulPartsLines}
                  style={{
                    fontSize: '13px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #185fa5',
                    background: '#e6f1fb',
                    color: '#185fa5',
                    cursor: (isPending || !partsActionsEnabled || !hasMeaningfulPartsLines) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Send vendor email
                </button>
                <button
                  type="button"
                  onClick={() => runTask(() => markPartsOrdered(job.id, buildPartsInput()))}
                  disabled={isPending || !partsActionsEnabled || !hasMeaningfulPartsLines}
                  style={{
                    fontSize: '13px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #0d6251',
                    background: '#e8f3f1',
                    color: '#0d6251',
                    cursor: (isPending || !partsActionsEnabled || !hasMeaningfulPartsLines) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Mark parts ordered
                </button>
                <button
                  type="button"
                  onClick={() => runTask(() => markReadyToSchedule(job.id, buildPartsInput()))}
                  disabled={isPending || !partsActionsEnabled || !hasMeaningfulPartsLines}
                  style={{
                    fontSize: '13px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #3b6d11',
                    background: '#eef5ea',
                    color: '#3b6d11',
                    cursor: (isPending || !partsActionsEnabled || !hasMeaningfulPartsLines) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Mark ready to schedule
                </button>
              </div>

              <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6 }}>
                {partsRequest?.vendor_email_sent_at && `Vendor emailed ${fmtDate(partsRequest.vendor_email_sent_at)}. `}
                {partsRequest?.ordered_at && `Parts ordered ${fmtDate(partsRequest.ordered_at)}. `}
                {partsRequest?.ready_to_schedule_at && `Marked ready to schedule ${fmtDate(partsRequest.ready_to_schedule_at)}. `}
                This keeps the parts and vendor trail attached to the same job record that started with the diagnosis.
              </div>
            </div>
          )}
        </Card>

        <Card title="Follow-Up Scheduling" rightText={selectedLeadTech ? `${selectedLeadTech.first_name} ${selectedLeadTech.last_name}` : 'Not scheduled yet'}>
          {!followUpSchedulingEnabled && (
            <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6 }}>
              Use the parts controls above until this job reaches ready to schedule. Once parts are in hand, book the return visit here and the same job will drop back into planning and the day-of jobs flow.
            </div>
          )}

          {followUpSchedulingEnabled && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Follow-up date
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={event => setFollowUpDate(event.target.value)}
                    style={{
                      width: '100%',
                      fontSize: '13px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d3d1c7',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#5f5e5a', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Lead tech
                  </label>
                  <select
                    value={followUpAssignedTechId}
                    onChange={event => {
                      const nextLeadTechId = event.target.value
                      setFollowUpAssignedTechId(nextLeadTechId)
                      setFollowUpAssistTechIds(currentIds => currentIds.filter(id => id !== nextLeadTechId))
                    }}
                    style={{
                      width: '100%',
                      fontSize: '13px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d3d1c7',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select lead tech</option>
                    {techs.map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#5f5e5a', fontWeight: 600, marginBottom: '8px' }}>Assist crew</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {techs
                    .filter(tech => tech.id !== followUpAssignedTechId)
                    .map(tech => {
                      const selected = followUpAssistTechIds.includes(tech.id)
                      return (
                        <button
                          key={tech.id}
                          type="button"
                          onClick={() => toggleAssistTech(tech.id)}
                          style={{
                            borderRadius: '999px',
                            border: selected ? '1px solid #185fa5' : '1px solid #d3d1c7',
                            background: selected ? '#e6f1fb' : '#fff',
                            color: selected ? '#185fa5' : '#1a1a18',
                            padding: '7px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {tech.first_name} {tech.last_name}
                        </button>
                      )
                    })}
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6 }}>
                {selectedAssistTechs.length > 0
                  ? `Assist crew selected: ${selectedAssistTechs.map(tech => `${tech.first_name} ${tech.last_name}`).join(', ')}.`
                  : 'No assist crew selected yet.'}
                {' '}Scheduling this revisit moves the job out of the estimate lane and back into operational planning on the chosen date.
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => runTask(() => scheduleFollowUp(job.id, buildFollowUpInput()), () => router.push('/planning'))}
                  disabled={isPending || !followUpDate || !followUpAssignedTechId}
                  style={{
                    fontSize: '13px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #0d6251',
                    background: '#0d6251',
                    color: '#fff',
                    cursor: (isPending || !followUpDate || !followUpAssignedTechId) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Schedule follow-up
                </button>
              </div>
            </div>
          )}
        </Card>

        {error && (
          <div style={{
            background: '#fcebeb',
            border: '1px solid #f7c1c1',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12px',
            color: '#a32d2d',
          }}>
            {error}
          </div>
        )}

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
          <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.6, flex: 1, minWidth: '240px' }}>
            Save the draft as you refine pricing and scope. Generate the PDF when the document is ready, mark it sent when the quote is out, and mark it approved once the customer moves forward.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => runTask(() => saveEstimateDraft(job.id, buildInput()))}
              disabled={isPending}
              style={{
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #d3d1c7',
                background: '#fff',
                cursor: isPending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => runTask(() => generateEstimatePdf(job.id, buildInput()))}
              disabled={isPending}
              style={{
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #4152a3',
                background: '#eef1fd',
                color: '#4152a3',
                cursor: isPending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {hasPdf ? 'Refresh PDF' : 'Generate PDF'}
            </button>
            <button
              type="button"
              onClick={() => runTask(() => markEstimateSent(job.id, buildInput()))}
              disabled={isPending}
              style={{
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #185fa5',
                background: '#e6f1fb',
                color: '#185fa5',
                cursor: isPending ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Mark sent
            </button>
            <button
              type="button"
              onClick={() => runTask(() => markEstimateApproved(job.id))}
              disabled={isPending || !hasSavedEstimate}
              style={{
                fontSize: '13px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #3b6d11',
                background: !hasSavedEstimate ? '#b4b2a9' : '#3b6d11',
                color: '#fff',
                cursor: (isPending || !hasSavedEstimate) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Mark approved
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
