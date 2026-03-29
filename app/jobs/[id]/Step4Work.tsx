'use client'

import { useState, useTransition } from 'react'
import { CatalogItem, DiagnosisItem, JobAddOn, JobAdhocLine, RepairBundle } from './types'
import { addJobAddOn, removeJobAddOn } from './actions'

interface Props {
  jobId: string
  workflowMode: 'diagnosis' | 'adhoc'
  selectedDiagnosis: DiagnosisItem | null
  repairBundles: RepairBundle[]
  catalogItems: CatalogItem[]
  addOns: JobAddOn[]
  setAddOns: (fn: (prev: JobAddOn[]) => JobAddOn[]) => void
  adhocDescription: string
  setAdhocDescription: (value: string) => void
  adhocLines: JobAdhocLine[]
  setAdhocLines: React.Dispatch<React.SetStateAction<JobAdhocLine[]>>
  adhocError: string | null
  postRepairFiles: File[]
  setPostRepairFiles: (files: File[]) => void
}

export default function Step4Work({
  jobId,
  workflowMode,
  selectedDiagnosis,
  repairBundles,
  catalogItems,
  addOns,
  setAddOns,
  adhocDescription,
  setAdhocDescription,
  adhocLines,
  setAdhocLines,
  adhocError,
  postRepairFiles,
  setPostRepairFiles,
}: Props) {
  const [tab, setTab] = useState<'bundles' | 'items'>('bundles')
  const [query, setQuery] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isPending, startTransition] = useTransition()

  const primaryBundle = selectedDiagnosis
    ? repairBundles.find(bundle => bundle.diagnosis_id === selectedDiagnosis.id) ?? null
    : null

  const normalizedQuery = query.trim().toLowerCase()

  const addonBundles = repairBundles.filter(bundle => {
    if (bundle.id === primaryBundle?.id) return false

    const matchesQuery =
      !normalizedQuery ||
      bundle.name.toLowerCase().includes(normalizedQuery) ||
      bundle.addon_description?.toLowerCase().includes(normalizedQuery) ||
      bundle.notes?.toLowerCase().includes(normalizedQuery)

    if (!matchesQuery) return false

    return normalizedQuery ? true : bundle.addon_eligible
  })

  const filteredItems = catalogItems.filter(item =>
    !query || item.name.toLowerCase().includes(query.toLowerCase()),
  )

  function qty(id: string) {
    return quantities[id] ?? 1
  }

  function setQty(id: string, quantity: number) {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, Math.min(10, quantity)) }))
  }

  function handleAddBundle(bundle: RepairBundle) {
    startTransition(async () => {
      const result = await addJobAddOn(jobId, 'bundle', bundle.id, null, 1)
      if (!result.error && result.id) {
        setAddOns(prev => [...prev, {
          id: result.id!,
          type: 'bundle',
          quantity: 1,
          repair_bundles: { id: bundle.id, name: bundle.name },
          items: null,
        }])
      }
    })
  }

  function handleAddItem(item: CatalogItem) {
    const quantity = qty(item.id)
    startTransition(async () => {
      const result = await addJobAddOn(jobId, 'item', null, item.id, quantity)
      if (!result.error && result.id) {
        setAddOns(prev => [...prev, {
          id: result.id!,
          type: 'item',
          quantity,
          repair_bundles: null,
          items: { id: item.id, name: item.name, unit: item.unit },
        }])
      }
    })
  }

  function handleRemove(addOnId: string) {
    startTransition(async () => {
      const result = await removeJobAddOn(addOnId)
      if (!result.error) {
        setAddOns(prev => prev.filter(addOn => addOn.id !== addOnId))
      }
    })
  }

  function handleAddAdhocItem(item: CatalogItem) {
    const quantity = qty(item.id)
    setAdhocLines(current => {
      const existing = current.find(line => line.items?.id === item.id)
      if (existing) {
        return current.map(line =>
          line.items?.id === item.id
            ? { ...line, quantity: Math.max(1, Math.min(99, line.quantity + quantity)) }
            : line,
        )
      }

      return [...current, {
        quantity,
        items: {
          id: item.id,
          name: item.name,
          type: item.type,
          unit: item.unit,
          is_placeholder: item.is_placeholder,
        },
      }]
    })
  }

  function updateAdhocLineQuantity(itemId: string, quantity: number) {
    setAdhocLines(current => current.map(line =>
      line.items?.id === itemId
        ? { ...line, quantity: Math.max(1, Math.min(99, quantity)) }
        : line,
    ))
  }

  function removeAdhocLine(itemId: string) {
    setAdhocLines(current => current.filter(line => line.items?.id !== itemId))
  }

  const tabButton = (target: 'bundles' | 'items', label: string) => (
    <button
      type="button"
      onClick={() => setTab(target)}
      style={{
        padding: '7px 16px',
        borderRadius: '6px',
        border: 'none',
        background: tab === target ? '#185fa5' : '#f5f4f0',
        color: tab === target ? '#fff' : '#5f5e5a',
        fontWeight: tab === target ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '12px',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      {workflowMode === 'diagnosis' ? (
        <>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Repair bundle - {selectedDiagnosis?.repair_code ?? 'no diagnosis'}
            </div>

            {primaryBundle ? (
              <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px' }}>
                {primaryBundle.repair_bundle_lines
                  .filter(line => line.items?.type !== 'profit')
                  .map(line => (
                    <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f5f4f0' }}>
                      <span style={{ fontSize: '13px' }}>{line.items?.name ?? '-'}</span>
                      <span style={{ fontSize: '12px', color: '#5f5e5a' }}>
                        {line.quantity} {line.items?.unit ?? ''}
                        {line.items?.is_placeholder && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', background: '#faeeda', color: '#854f0b', borderRadius: '3px', padding: '1px 4px' }}>
                            cost TBD
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                {primaryBundle.notes && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#5f5e5a', lineHeight: 1.5 }}>
                    <strong>Notes:</strong> {primaryBundle.notes}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#888780', padding: '8px 0' }}>
                {selectedDiagnosis ? 'No default repair bundle is defined for this diagnosis yet.' : 'Select a diagnosis in the previous step.'}
              </div>
            )}
          </div>

          {addOns.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Repair selections ({addOns.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {addOns.map(addOn => (
                  <div key={addOn.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#fff',
                    border: '1px solid #e2e1da',
                    borderRadius: '6px',
                    padding: '8px 12px',
                  }}>
                    <span style={{ flex: 1, fontSize: '13px' }}>
                      {addOn.type === 'bundle' ? addOn.repair_bundles?.name : addOn.items?.name}
                      {addOn.quantity > 1 && <span style={{ color: '#888780' }}> x{addOn.quantity}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(addOn.id)}
                      disabled={isPending}
                      style={{ fontSize: '12px', color: '#a32d2d', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Build the repair
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {tabButton('bundles', 'Bundles')}
              {tabButton('items', 'Items')}
            </div>

            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={tab === 'bundles' ? 'Search repair bundles...' : 'Search repair items...'}
              style={{
                width: '100%',
                fontSize: '13px',
                padding: '8px 12px',
                borderRadius: '7px',
                border: '1px solid #d3d1c7',
                fontFamily: 'inherit',
                outline: 'none',
                marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
              {tab === 'bundles' && addonBundles.map(bundle => (
                <div key={bundle.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#fff',
                  border: '1px solid #e2e1da',
                  borderRadius: '6px',
                  padding: '8px 12px',
                }}>
                  <span style={{ flex: 1, fontSize: '13px' }}>{bundle.name}</span>
                  <button
                    type="button"
                    onClick={() => handleAddBundle(bundle)}
                    disabled={isPending}
                    style={{
                      fontSize: '12px',
                      padding: '4px 12px',
                      borderRadius: '5px',
                      background: '#185fa5',
                      color: '#fff',
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Add
                  </button>
                </div>
              ))}

              {tab === 'bundles' && addonBundles.length === 0 && (
                <div style={{
                  background: '#fff',
                  border: '1px solid #e2e1da',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: '#716a5e',
                  lineHeight: 1.5,
                }}>
                  {normalizedQuery
                    ? `No repair bundles match "${query}".`
                    : 'No quick-add bundles are flagged yet. Start typing to search the full bundle catalog.'}
                </div>
              )}

              {tab === 'items' && filteredItems.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  border: '1px solid #e2e1da',
                  borderRadius: '6px',
                  padding: '8px 12px',
                }}>
                  <span style={{ flex: 1, fontSize: '13px' }}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button type="button" onClick={() => setQty(item.id, qty(item.id) - 1)} style={qtyBtn}>-</button>
                    <span style={{ fontSize: '13px', minWidth: '20px', textAlign: 'center' }}>{qty(item.id)}</span>
                    <button type="button" onClick={() => setQty(item.id, qty(item.id) + 1)} style={qtyBtn}>+</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddItem(item)}
                    disabled={isPending}
                    style={{
                      fontSize: '12px',
                      padding: '4px 12px',
                      borderRadius: '5px',
                      background: '#185fa5',
                      color: '#fff',
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Add
                  </button>
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
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Ad-hoc repair
            </div>
            <div style={{
              background: '#fff',
              border: '1px solid #e2e1da',
              borderRadius: '10px',
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.5, marginBottom: '8px' }}>
                Capture the one-off repair here. The owner will review this draft, set pricing, and decide whether to keep it one-off or build it into the catalog later.
              </div>
              <textarea
                rows={4}
                value={adhocDescription}
                onChange={event => setAdhocDescription(event.target.value)}
                placeholder="Describe the ad-hoc repair clearly."
                style={{
                  width: '100%',
                  fontSize: '13px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d3d1c7',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {adhocError && (
                <div style={{
                  background: '#fcebeb',
                  border: '1px solid #f7c1c1',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: '#a32d2d',
                  marginTop: '10px',
                }}>
                  {adhocError}
                </div>
              )}
            </div>
          </div>

          {adhocLines.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Ad-hoc line items ({adhocLines.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {adhocLines.map(line => (
                  <div key={line.items?.id ?? line.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#fff',
                    border: '1px solid #e2e1da',
                    borderRadius: '8px',
                    padding: '10px 12px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{line.items?.name ?? 'Line item'}</div>
                      <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>
                        {line.items?.type ?? 'item'}{line.items?.unit ? ` · ${line.items.unit}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button type="button" onClick={() => updateAdhocLineQuantity(line.items?.id ?? '', line.quantity - 1)} style={qtyBtn}>-</button>
                      <span style={{ fontSize: '13px', minWidth: '28px', textAlign: 'center' }}>{line.quantity}</span>
                      <button type="button" onClick={() => updateAdhocLineQuantity(line.items?.id ?? '', line.quantity + 1)} style={qtyBtn}>+</button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAdhocLine(line.items?.id ?? '')}
                      style={{ fontSize: '12px', color: '#a32d2d', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Add line items
            </div>

            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search catalog items for this ad-hoc repair..."
              style={{
                width: '100%',
                fontSize: '13px',
                padding: '8px 12px',
                borderRadius: '7px',
                border: '1px solid #d3d1c7',
                fontFamily: 'inherit',
                outline: 'none',
                marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
              {filteredItems.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  border: '1px solid #e2e1da',
                  borderRadius: '6px',
                  padding: '8px 12px',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>
                      {item.type}{item.unit ? ` · ${item.unit}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button type="button" onClick={() => setQty(item.id, qty(item.id) - 1)} style={qtyBtn}>-</button>
                    <span style={{ fontSize: '13px', minWidth: '20px', textAlign: 'center' }}>{qty(item.id)}</span>
                    <button type="button" onClick={() => setQty(item.id, qty(item.id) + 1)} style={qtyBtn}>+</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddAdhocItem(item)}
                    style={{
                      fontSize: '12px',
                      padding: '4px 12px',
                      borderRadius: '5px',
                      background: '#854f0b',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Add
                  </button>
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div style={{ fontSize: '12px', color: '#888780', padding: '8px 0' }}>No matching catalog items found.</div>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#5f5e5a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Post-repair photos
        </div>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: '#fff',
          border: '1px dashed #b4b2a9',
          borderRadius: '8px',
          padding: '12px 14px',
          cursor: 'pointer',
          fontSize: '13px',
          color: '#5f5e5a',
        }}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            style={{ display: 'none' }}
            onChange={event => setPostRepairFiles(event.target.files ? Array.from(event.target.files) : [])}
          />
          <span>{postRepairFiles.length > 0 ? `${postRepairFiles.length} selected` : 'Add post-repair photos'}</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#185fa5' }}>Update</span>
        </label>
      </div>
    </div>
  )
}

const qtyBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '4px',
  border: '1px solid #d3d1c7',
  background: '#f5f4f0',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}
