'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DiagnosisItem, Job } from '../types'
import { setDiagnosis, clearJobAdhocBundle } from '../actions'
import Card from '@/app/components/field/Card'
import Button from '@/app/components/field/Button'
import SpokeFooter from '@/app/components/field/SpokeFooter'
import { fieldControlClass } from '@/utils/field/styles'

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
  return list.filter(item =>
    [item.repair_code, item.invoice_description, item.location, item.component, item.action, item.cat1, item.cat2]
      .some(field => field?.toLowerCase().includes(lower)),
  )
}

type WorkflowMode = 'diagnosis' | 'adhoc'

const tstatLabels: Record<string, string> = {
  cool: 'Cool',
  heat: 'Heat',
  em_heat: 'EM heat',
  fan_only: 'Fan only',
  off: 'Off',
}

export default function DiagnoseClient({ job, diagnoses }: { job: Job; diagnoses: DiagnosisItem[] }) {
  const router = useRouter()
  const [transitioning, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const initialDiagnosis = job.diagnosis_id
    ? diagnoses.find(item => item.id === job.diagnosis_id) ?? null
    : null
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisItem | null>(initialDiagnosis)
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(
    job.adhoc_bundle && !job.diagnosis_id ? 'adhoc' : 'diagnosis',
  )
  const [adhocDescription, setAdhocDescription] = useState(job.adhoc_bundle?.tech_description ?? '')

  const canContinue = workflowMode === 'diagnosis' ? !!selectedDiagnosis : !!adhocDescription.trim()
  const hasSearch = query.trim().length > 0
  const filtered = useMemo(
    () => (hasSearch ? filterDiagnoses(diagnoses, query) : []),
    [diagnoses, query, hasSearch],
  )

  const referenceRefrigerant = job.systems?.refrigerant_type || 'R-410A'
  const referenceMetering = job.systems?.metering_device ?? ''
  const pressures = PRESSURES[referenceRefrigerant]
  const isTxv = referenceMetering.toLowerCase().includes('txv')
  const superheat = SUPERHEAT[referenceRefrigerant]

  function handleNext() {
    if (!canContinue) return
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Diagnose
            </div>
            <h1 className="text-xl font-bold text-stone-900">What is wrong with it?</h1>
          </div>

          <Card>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Captured readings
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip label="Mode" value={tstatLabels[job.tstat_mode ?? ''] ?? '—'} />
              <Chip label="Fan" value={job.tstat_fan ? job.tstat_fan.toUpperCase() : '—'} />
              <Chip label="Return" value={job.temp_return != null ? `${job.temp_return} F` : '—'} />
              <Chip label="Supply" value={job.temp_supply != null ? `${job.temp_supply} F` : '—'} />
            </div>
          </Card>

          {pressures && (
            <Card>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Rules of thumb
              </div>
              <div className="mb-3 text-sm text-stone-600">
                {referenceRefrigerant}{referenceMetering ? ` / ${referenceMetering}` : ''}
              </div>
              <div className="grid grid-cols-1 gap-2">
                <RuleRow label="Suction" value={pressures.suction} />
                <RuleRow label="Liquid" value={pressures.liquid} />
                <RuleRow
                  label={isTxv ? 'Superheat (TXV)' : 'Superheat (fixed)'}
                  value={isTxv ? (superheat?.txv ?? '—') : (superheat?.fixed ?? '—')}
                />
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWorkflowMode('diagnosis')}
              className={[
                'min-h-[48px] rounded-xl border text-sm font-semibold',
                workflowMode === 'diagnosis'
                  ? 'border-blue-700 bg-blue-50 text-blue-800'
                  : 'border-stone-300 bg-white text-stone-700',
              ].join(' ')}
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDiagnosis(null)
                setWorkflowMode('adhoc')
              }}
              className={[
                'min-h-[48px] rounded-xl border text-sm font-semibold',
                workflowMode === 'adhoc'
                  ? 'border-amber-800 bg-amber-50 text-amber-900'
                  : 'border-stone-300 bg-white text-stone-700',
              ].join(' ')}
            >
              Ad-hoc
            </button>
          </div>

          {workflowMode === 'diagnosis' ? (
            <>
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search repair codes"
                className={fieldControlClass}
                autoCapitalize="none"
              />

              {selectedDiagnosis && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Selected: <strong>{selectedDiagnosis.repair_code}</strong>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {!hasSearch && (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-stone-500">
                    Search by code, part, or symptom. Results stay short so you can pick with a thumb.
                  </div>
                )}
                {hasSearch && filtered.length === 0 && (
                  <div className="py-2 text-sm text-stone-500">
                    No codes match “{query}”. Switch to ad-hoc if nothing fits.
                  </div>
                )}
                {filtered.slice(0, 25).map(item => {
                  const active = selectedDiagnosis?.id === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setWorkflowMode('diagnosis')
                        setSelectedDiagnosis(item)
                      }}
                      className={[
                        'min-h-[64px] rounded-2xl border p-4 text-left',
                        active ? 'border-blue-600 bg-blue-50' : 'border-stone-200 bg-white',
                      ].join(' ')}
                    >
                      <div className="font-mono text-sm font-bold text-blue-800">{item.repair_code}</div>
                      <div className="mt-1 text-sm leading-snug text-stone-700">
                        {item.invoice_description ?? '—'}
                      </div>
                    </button>
                  )
                })}
                {filtered.length > 25 && (
                  <div className="text-xs text-stone-500">Showing first 25 matches. Keep typing to narrow it down.</div>
                )}
              </div>
            </>
          ) : (
            <Card>
              <div className="mb-1 text-base font-bold text-stone-900">Ad-hoc repair</div>
              <p className="mb-3 text-sm leading-relaxed text-stone-600">
                Use this when no catalog diagnosis fits. Describe the work clearly enough for owner review.
              </p>
              <textarea
                rows={5}
                value={adhocDescription}
                onChange={event => setAdhocDescription(event.target.value)}
                placeholder="What failed, what you did, and anything the office needs to price it."
                className={`${fieldControlClass} min-h-[140px] resize-y leading-relaxed`}
              />
            </Card>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </div>

      <SpokeFooter>
        <Button type="button" onClick={() => router.push(`/jobs/${job.id}/observe`)}>
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          fullWidth
          onClick={handleNext}
          disabled={transitioning || !canContinue}
        >
          {transitioning ? 'Saving…' : 'Continue to repair'}
        </Button>
      </SpokeFooter>
    </div>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="text-sm font-semibold text-stone-900">{value}</div>
    </div>
  )
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="text-sm font-bold text-stone-900">{value}</div>
    </div>
  )
}
