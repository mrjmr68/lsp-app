'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CatalogItem, DiagnosisItem, Job, JobAddOn, JobAdhocLine, RepairBundle } from '../types'
import { addJobAddOn, removeJobAddOn, saveJobAdhocBundle } from '../actions'

interface Props {
  job: Job
  workflowMode: 'diagnosis' | 'adhoc'
  selectedDiagnosis: DiagnosisItem | null
  repairBundles: RepairBundle[]
  catalogItems: CatalogItem[]
  existingAddOns: JobAddOn[]
}

const qtyBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: '4px', border: '1px solid #d3d1c7',
  background: '#f5f4f0', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
}

export default function WorkClient({
  job,
  workflowMode,
  selectedDiagnosis,
  repairBundles,
  catalogItems,
  existingAddOns,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'bundles' | 'items'>('bundles')
  const [query, setQuery] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isPending, startTransition] = useTransition()
  const [addOns, setAddOns] = useState<JobAddOn[]>(existingAddOns)
  const [adhocDescription, setAdhocDescription] = useState(job.adhoc_bundle?.tech_description ?? '')
  const [adhocLines, setAdhocLines] = useState<JobAdhocLine[]>(job.adhoc_bundle?.job_adhoc_bundle_lines ?? [])
  const [adhocError, setAdhocError] = useState<string | null>(null)
  const [postRepairFiles, setPostRepairFiles] = useState<File[]>([])

  const primaryBundle = selectedDiagnosis
    ? repairBundles.find(b => b.diagnosis_id === selectedDiagnosis.id) ?? null
    : null

  const normalizedQuery = query.trim().toLowerCase()
  const addonBundles = repairBundles.filter(b => {
    if (b.id === primaryBundle?.id) return false
    const matchesQuery = !normalizedQuery || b.name.toLowerCase().includes(normalizedQuery) || b.addon_description?.toLowerCase().includes(normalizedQuery)
    if (!matchesQuery) return false
    return normalizedQuery ? true : b.addon_eligible
  })

  const filteredItems = catalogItems.filter(i => !query || i.name.toLowerCase().includes(query.toLowerCase()))

  function qty(id: string) { return quantities[id] ?? 1 }
  function setQty(id: string, q: number) { setQuantities(p => ({ ...p, [id]: Math.max(1, Math.min(10, q)) })) }

  function handleAddBundle(bundle: RepairBundle) {
    startTransition(async () => {
      const result = await addJobAddOn(job.id, 'bundle', bundle.id, null, 1)
      if (!result.error && result.id) {
        setAddOns(p => [...p, { id: result.id!, type: 'bundle', quantity: 1, repair_bundles: { id: bundle.id, name: bundle.name }, items: null }])
      }
    })
  }

  function handleAddItem(item: CatalogItem) {
    const q = qty(item.id)
    startTransition(async () => {
      const result = await addJobAddOn(job.id, 'item', null, item.id, q)
      if (!result.error && result.id) {
        setAddOns(p => [...p, { id: result.id!, type: 'item', quantity: q, repair_bundles: null, items: { id: item.id, name: item.name, unit: item.unit } }])
      }
    })
  }

  function handleRemove(addOnId: string) {
    startTransition(async () => {
      const result = await removeJobAddOn(addOnId)
      if (!result.error) setAddOns(p => p.filter(a => a.id !== addOnId))
    })
  }

  function handleAddAdhocItem(item: CatalogItem) {
    const q = qty(item.id)
    setAdhocLines(current => {
      const existing = current.find(l => l.items?.id === item.id)
      if (existing) return current.map(l => l.items?.id === item.id ? { ...l, quantity: Math.max(1, Math.min(99, l.quantity + q)) } : l)
      return [...current, { quantity: q, items: { id: item.id, name: item.name, type: item.type, unit: item.unit, is_placeholder: item.is_placeholder } }]
    })
  }

  async function handleNext() {
    setAdhocError(null)

    if (workflowMode === 'adhoc') {
      startTransition(async () => {
        const result = await saveJobAdhocBundle(job.id, {
          tech_description: adhocDescription,
          lines: adhocLines
            .filter(l => !!l.items?.id && Number.isFinite(l.quantity) && l.quantity > 0)
            .map(l => ({ item_id: l.items!.id, quantity: l.quantity })),
        })
        if (result.error) {
          setAdhocError(result.error)
          return
        }
        router.push(`/jobs/${job.id}/close`)
      })
    } else {
      router.push(`/jobs/${job.id}/close`)
    }
  }

  const tabButton = (target: 'bundles' | 'items', label: string) => (
    <button
      type="button"
      onClick={() => setTab(target)}
      style={{
        padding: '7px 16px', borderRadius: '6px', border: 'none',
        background: tab === target ? '#185fa5' : '#f5f4f0',
        color: tab === target ? '#fff' : '#5f5e5a',
        fontWeight: tab === target ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {workflowMode === 'diagnosis' ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Repair bundle - {selectedDiagnosis?.repair_code ?? 'no diagnosis'}
              </div>
              {primaryBundle ? (
                <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px' }}>
                  {primaryBundle.repair_bundle_lines.filter(l => l.items?.type !== 'profit').map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f5f4f0' }}>
                      <span style={{ fontSize: '13px' }}>{l.items?.name ?? '-'}</span>
                      <span style={{ fontSize: '12px', color: '#5f5e5a' }}>
                        {l.quantity} {l.items?.unit ?? ''}
                        {l.items?.is_placeholder && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#faeeda', color: '#854f0b', borderRadius: '3px', padding: '1px 4px' }}>cost TBD</span>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#888780', padding: '8px 0' }}>
                  {selectedDiagnosis ? 'No default repair bundle defined.' : 'Select a diagnosis in the previous step.'}
                </div>
              )}
            </div>

            {addOns.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Repair selections ({addOns.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {addOns.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid #e2e1da', borderRadius: '6px', padding: '8px 12px' }}>
                      <span style={{ flex: 1, fontSize: '13px' }}>
                        {a.type === 'bundle' ? a.repair_bundles?.name : a.items?.name}
                        {a.quantity > 1 && <span style={{ color: '#888780' }}> x{a.quantity}</span>}
                      </span>
                      <button type="button" onClick={() => handleRemove(a.id)} disabled={isPending} style={{ fontSize: '12px', color: '#a32d2d', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Build the repair</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                {tabButton('bundles', 'Bundles')}
                {tabButton('items', 'Items')}
              </div>
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={tab === 'bundles' ? 'Search repair bundles...' : 'Search repair items...'} style={{ width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '7px', border: '1px solid #d3d1c7', fontFamily: 'inherit', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
                {tab === 'bundles' && addonBundles.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid #e2e1da', borderRadius: '6px', padding: '8px 12px' }}>
                    <span style={{ flex: 1, fontSize: '13px' }}>{b.name}</span>
                    <button type="button" onClick={() => handleAddBundle(b)} disabled={isPending} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '5px', background: '#185fa5', color: '#fff', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Add</button>
                  </div>
                ))}
                {tab === 'bundles' && addonBundles.length === 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#716a5e', lineHeight: 1.5 }}>
                    {normalizedQuery ? `No repair bundles match "${query}".` : 'No quick-add bundles flagged yet. Start typing to search.'}
                  </div>
                )}
                {tab === 'items' && filteredItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e1da', borderRadius: '6px', padding: '8px 12px' }}>
                    <span style={{ flex: 1, fontSize: '13px' }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button type="button" onClick={() => setQty(item.id, qty(item.id) - 1)} style={qtyBtn}>-</button>
                      <span style={{ fontSize: '13px', minWidth: '20px', textAlign: 'center' }}>{qty(item.id)}</span>
                      <button type="button" onClick={() => setQty(item.id, qty(item.id) + 1)} style={qtyBtn}>+</button>
                    </div>
                    <button type="button" onClick={() => handleAddItem(item)} disabled={isPending} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '5px', background: '#185fa5', color: '#fff', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Add</button>
                  </div>
                ))}
                {tab === 'items' && filteredItems.length === 0 && (
                  <div style={{ fontSize: '12px', color: '#888780', padding: '8px 0' }}>No matching repair items found.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Ad-hoc repair</div>
              <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.5, marginBottom: '8px' }}>
                  Capture the one-off repair. The owner will review, price, and decide whether to catalog it.
                </div>
                <textarea rows={4} value={adhocDescription} onChange={e => setAdhocDescription(e.target.value)} placeholder="Describe the ad-hoc repair clearly." style={{ width: '100%', fontSize: '13px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d3d1c7', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box', outline: 'none' }} />
                {adhocError && <div style={{ background: '#fcebeb', border: '1px solid #f7c1c1', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#a32d2d', marginTop: '10px' }}>{adhocError}</div>}
              </div>
            </div>

            {adhocLines.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Ad-hoc line items ({adhocLines.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {adhocLines.map(l => (
                    <div key={l.items?.id ?? l.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{l.items?.name ?? 'Line item'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button type="button" onClick={() => setAdhocLines(c => c.map(x => x.items?.id === l.items?.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} style={qtyBtn}>-</button>
                        <span style={{ fontSize: '13px', minWidth: '28px', textAlign: 'center' }}>{l.quantity}</span>
                        <button type="button" onClick={() => setAdhocLines(c => c.map(x => x.items?.id === l.items?.id ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x))} style={qtyBtn}>+</button>
                      </div>
                      <button type="button" onClick={() => setAdhocLines(c => c.filter(x => x.items?.id !== l.items?.id))} style={{ fontSize: '12px', color: '#a32d2d', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Add line items</div>
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search catalog items..." style={{ width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '7px', border: '1px solid #d3d1c7', fontFamily: 'inherit', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
                {filteredItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e1da', borderRadius: '6px', padding: '8px 12px' }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '13px' }}>{item.name}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button type="button" onClick={() => setQty(item.id, qty(item.id) - 1)} style={qtyBtn}>-</button>
                      <span style={{ fontSize: '13px', minWidth: '20px', textAlign: 'center' }}>{qty(item.id)}</span>
                      <button type="button" onClick={() => setQty(item.id, qty(item.id) + 1)} style={qtyBtn}>+</button>
                    </div>
                    <button type="button" onClick={() => handleAddAdhocItem(item)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '5px', background: '#854f0b', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Post-repair photos</div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#fff', border: '1px dashed #b4b2a9', borderRadius: '8px', padding: '12px 14px', cursor: 'pointer', fontSize: '13px', color: '#5f5e5a' }}>
            <input type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={e => setPostRepairFiles(e.target.files ? Array.from(e.target.files) : [])} />
            <span>{postRepairFiles.length > 0 ? `${postRepairFiles.length} selected` : 'Add post-repair photos'}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#185fa5' }}>Update</span>
          </label>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid #e2e1da', padding: '12px 16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => router.push(`/jobs/${job.id}/diagnose`)} style={{ padding: '11px 20px', borderRadius: '8px', border: '1px solid #d3d1c7', background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>{'<- Back'}</button>
        <button
          onClick={handleNext}
          disabled={isPending}
          style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: isPending ? '#b4b2a9' : '#185fa5', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {isPending ? 'Saving...' : 'Close ->'}
        </button>
      </div>
    </div>
  )
}
