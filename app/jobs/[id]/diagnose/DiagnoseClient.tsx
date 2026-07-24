'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DiagnosisItem, Job } from '../types'
import { setDiagnosis, clearJobAdhocBundle, saveObservations, saveObservedSystemSnapshot } from '../actions'
import SegControl from '../components/SegControl'

const PRESSURES: Record<string, { suction: string; liquid: string }> = {
  'R-410A': { suction: '115-130 PSI', liquid: '380-430 PSI' },
  'R-22': { suction: '58-68 PSI', liquid: '225-265 PSI' },
  'R-32': { suction: '170-195 PSI', liquid: '480-540 PSI' },
}

const SUPERHEAT: Record<string, { txv: string; fixed: string }> = {
  'R-410A': { txv: '8-12 F', fixed: '10-18 F' },
  'R-22': { txv: '8-12 F', fixed: '10-18 F' },
  'R-32': { txv: '6-10 F', fixed: '10-15 F' },
}

function filterDiagnoses(list: DiagnosisItem[], query: string) {
  if (!query.trim()) return list
  const lower = query.toLowerCase()
  return list.filter(d =>
    [d.repair_code, d.invoice_description, d.location, d.component, d.action, d.cat1, d.cat2]
      .some(f => f?.toLowerCase().includes(lower)),
  )
}

type WorkflowMode = 'diagnosis' | 'adhoc'

export default function DiagnoseClient({ job, diagnoses }: { job: Job; diagnoses: DiagnosisItem[] }) {
  const router = useRouter()
  const [transitioning, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showNoMatch, setShowNoMatch] = useState(false)

  const initialDiagnosis = job.diagnosis_id
    ? diagnoses.find(d => d.id === job.diagnosis_id) ?? null
    : null
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisItem | null>(initialDiagnosis)
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(
    job.adhoc_bundle && !job.diagnosis_id ? 'adhoc' : 'diagnosis'
  )
  const [adhocDescription, setAdhocDescription] = useState(job.adhoc_bundle?.tech_description ?? '')

  const step3Valid = workflowMode === 'diagnosis' ? !!selectedDiagnosis : !!adhocDescription.trim()
  const filtered = filterDiagnoses(diagnoses, query)

  // Observation context summary
  const referenceRefrigerant = job.systems?.refrigerant_type || 'R-410A'
  const referenceMetering = job.systems?.metering_device ?? ''
  const pressures = PRESSURES[referenceRefrigerant]
  const isTxv = referenceMetering.toLowerCase().includes('txv')
  const superheat = SUPERHEAT[referenceRefrigerant]

  async function handleNext() {
    if (!step3Valid) return
    setError(null)

    startTransition(async () => {
      if (workflowMode === 'diagnosis') {
        const result = await setDiagnosis(job.id, selectedDiagnosis?.id ?? null)
        if (result.error) {
          setError(result.error)
          return
        }
        if (job.adhoc_bundle) {
          const clearResult = await clearJobAdhocBundle(job.id)
          if (clearResult.error) {
            setError(clearResult.error)
            return
          }
        }
      }
      router.push(`/jobs/${job.id}/work`)
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Observation context card */}
        <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>
          <div style={{
            background: '#fff',
            border: '1px solid #ddd5bf',
            borderRadius: '18px',
            padding: '18px',
            boxShadow: '0 14px 32px rgba(23, 25, 29, 0.08)',
            marginBottom: '18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Observation Context
                </div>
                <div style={{ fontSize: '13px', color: '#655f54', marginTop: '4px' }}>
                  Review the readings captured before selecting the final diagnosis.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <SegControl
                label="Mode"
                value={job.tstat_mode ?? ''}
                onChange={() => {}}
                options={[
                  { value: 'cool', label: 'Cool', activeColor: { bg: '#185fa5', fg: '#fff' } },
                  { value: 'off', label: 'Off', activeColor: { bg: '#5f5e5a', fg: '#fff' } },
                  { value: 'heat', label: 'Heat', activeColor: { bg: '#854f0b', fg: '#fff' } },
                  { value: 'em_heat', label: 'EM', activeColor: { bg: '#a32d2d', fg: '#fff' } },
                ]}
              />
              <SegControl
                label="Fan"
                value={job.tstat_fan ?? ''}
                onChange={() => {}}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'on', label: 'On' },
                ]}
              />
            </div>
          </div>

          {/* Rules of thumb */}
          {pressures && (
            <div style={{
              background: 'linear-gradient(180deg, #fffaf0 0%, #f8f2e3 100%)',
              border: '1px solid #dcc88f',
              borderRadius: '18px',
              padding: '18px',
              boxShadow: '0 14px 32px rgba(23, 25, 29, 0.08)',
              marginBottom: '18px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#20242a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Rules Of Thumb
              </div>
              <div style={{ fontSize: '13px', color: '#655f54', marginBottom: '12px' }}>
                Guidance for {referenceRefrigerant}{referenceMetering ? ` / ${referenceMetering}` : ''}.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <RuleRow label="Reference suction" value={pressures.suction} />
                <RuleRow label="Reference liquid" value={pressures.liquid} />
                <RuleRow label={isTxv ? 'Target superheat (TXV)' : 'Target superheat (fixed)'} value={isTxv ? (superheat?.txv ?? '-') : (superheat?.fixed ?? '-')} />
              </div>
            </div>
          )}

          {/* Diagnosis / Adhoc selector */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => setWorkflowMode('diagnosis')}
              style={{
                padding: '8px 14px', borderRadius: '999px',
                border: workflowMode === 'diagnosis' ? '1px solid #185fa5' : '1px solid #d3d1c7',
                background: workflowMode === 'diagnosis' ? '#e6f1fb' : '#fff',
                color: workflowMode === 'diagnosis' ? '#185fa5' : '#5f5e5a',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
              }}
            >
              Diagnosis
            </button>
            <button
              type="button"
              onClick={() => { setSelectedDiagnosis(null); setWorkflowMode('adhoc') }}
              style={{
                padding: '8px 14px', borderRadius: '999px',
                border: workflowMode === 'adhoc' ? '1px solid #854f0b' : '1px solid #d3d1c7',
                background: workflowMode === 'adhoc' ? '#faeeda' : '#fff',
                color: workflowMode === 'adhoc' ? '#854f0b' : '#5f5e5a',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
              }}
            >
              Ad-hoc repair
            </button>
          </div>

          {workflowMode === 'diagnosis' ? (
            <>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search diagnosis codes..."
                style={{
                  width: '100%', fontSize: '14px', padding: '12px 14px', borderRadius: '12px',
                  border: '1px solid #d3d1c7', fontFamily: 'inherit', outline: 'none',
                  marginBottom: '10px', boxSizing: 'border-box', background: '#fff',
                }}
              />

              {selectedDiagnosis && (
                <div style={{
                  background: '#e6f1fb', border: '1px solid #a8c8f0', borderRadius: '12px',
                  padding: '10px 14px', marginBottom: '10px', fontSize: '12px', color: '#185fa5',
                }}>
                  Selected: <strong>{selectedDiagnosis.repair_code}</strong>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', maxHeight: '340px', overflowY: 'auto' }}>
                {filtered.length === 0 && (
                  <div style={{ fontSize: '13px', color: '#888780', padding: '12px 0' }}>
                    No codes match &quot;{query}&quot;
                  </div>
                )}
                {filtered.map(d => {
                  const active = selectedDiagnosis?.id === d.id
                  return (
                    <button
                      key={d.id}
                      onClick={() => { setWorkflowMode('diagnosis'); setSelectedDiagnosis(d) }}
                      style={{
                        textAlign: 'left', padding: '12px 14px', borderRadius: '12px',
                        border: active ? '1.5px solid #378add' : '1px solid #e2e1da',
                        background: active ? '#f0f7ff' : '#fff',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#185fa5', fontFamily: 'monospace', marginBottom: '2px' }}>
                        {d.repair_code}
                      </div>
                      <div style={{ fontSize: '12px', color: '#5f5e5a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.invoice_description ?? '-'}
                      </div>
                    </button>
                  )
                })}
              </div>

              {!showNoMatch ? (
                <button
                  onClick={() => { setShowNoMatch(true); setSelectedDiagnosis(null); setWorkflowMode('adhoc') }}
                  style={{ fontSize: '12px', color: '#888780', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
                >
                  {'Nothing matches ->'}
                </button>
              ) : (
                <div style={{
                  background: '#faeeda', border: '1px solid #f5c97a', borderRadius: '12px',
                  padding: '12px 14px', fontSize: '12px', color: '#633806',
                }}>
                  <strong>Use the ad-hoc repair path instead.</strong> Switch to ad-hoc repair and describe the work for owner review.
                </div>
              )}
            </>
          ) : (
            <div style={{
              background: '#fff', border: '1px solid #e2e1da', borderRadius: '12px', padding: '14px 16px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a18', marginBottom: '6px' }}>
                Ad-hoc repair
              </div>
              <div style={{ fontSize: '12px', color: '#5f5e5a', lineHeight: 1.5, marginBottom: '10px' }}>
                Use this when no standard diagnosis fits. The owner will review your ad-hoc repair and price it.
              </div>
              <textarea
                rows={4}
                value={adhocDescription}
                onChange={e => setAdhocDescription(e.target.value)}
                placeholder="Describe the repair clearly enough for owner review."
                style={{
                  width: '100%', fontSize: '13px', padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid #d3d1c7', fontFamily: 'inherit', resize: 'vertical',
                  lineHeight: 1.5, boxSizing: 'border-box', outline: 'none',
                }}
              />
              {error && (
                <div style={{
                  background: '#fcebeb', border: '1px solid #f7c1c1', borderRadius: '10px',
                  padding: '10px 12px', fontSize: '12px', color: '#a32d2d', marginTop: '10px',
                }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid #e2e1da', padding: '12px 16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => router.push(`/jobs/${job.id}/observe`)}
          style={{ padding: '11px 20px', borderRadius: '8px', border: '1px solid #d3d1c7', background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {'<- Back'}
        </button>
        <button
          onClick={handleNext}
          disabled={transitioning || !step3Valid}
          style={{
            flex: 1, padding: '11px', borderRadius: '8px', border: 'none',
            background: (transitioning || !step3Valid) ? '#b4b2a9' : '#185fa5',
            color: '#fff', fontSize: '13px', fontWeight: 600,
            cursor: (transitioning || !step3Valid) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {transitioning ? 'Saving...' : 'Work ->'}
        </button>
      </div>
    </div>
  )
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid #ead9ab', borderRadius: '14px', padding: '12px 14px' }}>
      <div style={{ fontSize: '11px', color: '#6f685b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2329' }}>{value}</div>
    </div>
  )
}
