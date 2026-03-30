'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DiagnosisItem, Job, JobAddOn, JobAdhocLine, JobCrewMember, JobMessage, JobWorkflow, ObservationCircuitState } from './types'
import { closeJob, saveJobChecklistItemNote, setJobChecklistItemStatus, updateJobWorkflowStatus } from './actions'

interface Props {
  job: Job
  workflow: JobWorkflow | null
  crewMembers: JobCrewMember[]
  jobMessages: JobMessage[]
  workflowMode: 'diagnosis' | 'adhoc'
  selectedDiagnosis: DiagnosisItem | null
  adhocDescription: string
  adhocLines: JobAdhocLine[]
  tstatMode: string
  tstatFan: string
  tempOutdoor: string
  tempReturn: string
  tempSupply: string
  observationCircuits: ObservationCircuitState[]
  addOns: JobAddOn[]
  observationFiles: File[]
  postRepairFiles: File[]
  canCloseJob: boolean
}

type CompletionPath = 'invoice' | 'estimate'

function getGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 },
    )
  })
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function uploadPhotos(jobId: string, type: string, files: File[]) {
  if (!files.length) return

  const { createClient } = await import('@/utils/supabase/client')
  const supabase = createClient()

  const uploadResults = await Promise.all(
    files.map(async (file, index) => {
      const path = `${jobId}/${type}/${Date.now()}-${index}-${safeFileName(file.name)}`
      const { error } = await supabase.storage.from('job-photos').upload(path, file, {
        upsert: false,
      })
      return {
        fileName: file.name,
        error,
      }
    }),
  )

  const failures = uploadResults.filter(result => result.error)
  if (failures.length > 0) {
    const failedNames = failures.map(result => result.fileName).join(', ')
    throw new Error(`Photo upload failed for: ${failedNames}`)
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '5px 0', borderBottom: '1px solid #f5f4f0' }}>
      <span style={{ fontSize: '11px', color: '#888780', width: '110px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#1a1a18' }}>{value || '-'}</span>
    </div>
  )
}

const tstatLabels: Record<string, string> = {
  cool: 'Cool',
  heat: 'Heat',
  em_heat: 'Em heat',
  fan_only: 'Fan only',
  off: 'Off',
}

function formatDelta(tempReturn: string, tempSupply: string, tstatMode: string) {
  const returnValue = parseFloat(tempReturn)
  const supplyValue = parseFloat(tempSupply)
  if (Number.isNaN(returnValue) || Number.isNaN(supplyValue)) return '-'
  const rawDelta = tstatMode === 'heat' || tstatMode === 'em_heat'
    ? supplyValue - returnValue
    : returnValue - supplyValue
  return `${Math.round(rawDelta * 10) / 10} F`
}

function formatReading(value: string, suffix: string) {
  return value ? `${value} ${suffix}` : '-'
}

export default function Step5Close({
  job,
  workflow,
  crewMembers,
  jobMessages,
  workflowMode,
  selectedDiagnosis,
  adhocDescription,
  adhocLines,
  tstatMode,
  tstatFan,
  tempOutdoor,
  tempReturn,
  tempSupply,
  observationCircuits,
  addOns,
  observationFiles,
  postRepairFiles,
  canCloseJob,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [isChecklistPending, startChecklistTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [completionPath, setCompletionPath] = useState<CompletionPath>('invoice')
  const router = useRouter()
  const workflowRequiredItems = workflow?.job_workflow_items.filter(item => item.required) ?? []
  const completedWorkflowItems = workflowRequiredItems.filter(item => item.completed).length
  const sharedWorkflowJob = workflow != null
  const diagnosisEstimateEligible = !sharedWorkflowJob && workflowMode === 'diagnosis' && !!selectedDiagnosis
  const effectiveCompletionPath: CompletionPath = diagnosisEstimateEligible ? completionPath : 'invoice'
  const closeoutItems = useMemo(
    () => (workflow?.job_workflow_items ?? [])
      .filter(item => item.phase === 'closeout')
      .sort((a, b) => a.sort_order - b.sort_order),
    [workflow],
  )

  function handleChecklistAction(task: () => Promise<{ error?: string | null }>) {
    setError(null)
    startChecklistTransition(async () => {
      const result = await task()
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleClose() {
    setError(null)
    startTransition(async () => {
      try {
        await uploadPhotos(job.id, 'observation', observationFiles)
        await uploadPhotos(job.id, 'post_repair', postRepairFiles)

        const position = await getGps()
        const result = await closeJob(job.id, position?.lat ?? null, position?.lng ?? null, effectiveCompletionPath)
        if (result.error) {
          setError(result.error)
        } else {
          router.push('/jobs')
        }
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'Photo upload failed. Please try again.')
      }
    })
  }

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      {sharedWorkflowJob && (
        <>
          <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Shared Workflow
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              {workflow.workflow_type === 'install' ? 'Install' : 'Major Repair'}
            </div>
            <div style={{ fontSize: '12px', color: '#5f5e5a', marginTop: '6px' }}>
              {completedWorkflowItems} of {workflowRequiredItems.length} required checklist items complete
            </div>
            {workflow.status !== 'closeout' && workflow.status !== 'complete' && (
              <button
                type="button"
                onClick={() => handleChecklistAction(() => updateJobWorkflowStatus(job.id, 'closeout'))}
                disabled={isChecklistPending}
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '9px',
                  border: '1px solid #d3d1c7',
                  background: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: isChecklistPending ? 'not-allowed' : 'pointer',
                }}
              >
                Move to Closeout
              </button>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Crew
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {crewMembers.map(member => (
                <span
                  key={`${member.id}-${member.assignment_role}`}
                  style={{ borderRadius: '999px', background: '#f1efe8', color: '#1a1a18', padding: '6px 10px', fontSize: '12px', fontWeight: 600 }}
                >
                  {[member.first_name, member.last_name].filter(Boolean).join(' ')}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Message Activity
            </div>
            <div style={{ fontSize: '13px', color: '#1a1a18' }}>
              {jobMessages.length} shared update{jobMessages.length === 1 ? '' : 's'} captured
            </div>
          </div>

          {closeoutItems.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Completion Checklist
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {closeoutItems.map(item => (
                  <div key={item.id} style={{ border: '1px solid #ece8de', borderRadius: '8px', padding: '10px 12px', background: item.completed ? '#f4fbef' : '#fcfbf8' }}>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a18' }}>
                          {item.label}
                        </div>
                        {item.details && (
                          <div style={{ fontSize: '12px', color: '#716a5e', marginTop: '4px', lineHeight: 1.45 }}>
                            {item.details}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleChecklistAction(() => setJobChecklistItemStatus(item.id, !item.completed))}
                        disabled={isChecklistPending}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          border: item.completed ? '1px solid #9cca72' : '1px solid #d3d1c7',
                          background: item.completed ? '#eaf3de' : '#fff',
                          color: item.completed ? '#31590f' : '#5f5e5a',
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          cursor: isChecklistPending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {item.completed ? 'Done' : 'Mark Done'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <input
                        type="text"
                        value={noteDrafts[item.id] ?? item.note ?? ''}
                        onChange={event => setNoteDrafts(current => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="Add completion note"
                        style={{
                          flex: 1,
                          fontSize: '12px',
                          padding: '8px 10px',
                          borderRadius: '9px',
                          border: '1px solid #d7d4ca',
                          background: '#fff',
                          fontFamily: 'inherit',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleChecklistAction(() => saveJobChecklistItemNote(item.id, noteDrafts[item.id] ?? item.note ?? ''))}
                        disabled={isChecklistPending}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '9px',
                          border: '1px solid #d3d1c7',
                          background: '#fff',
                          fontSize: '12px',
                          fontFamily: 'inherit',
                          cursor: isChecklistPending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!sharedWorkflowJob && (
        <>
      <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          {workflowMode === 'adhoc' ? 'Repair Path' : 'Diagnosis'}
        </div>
        {workflowMode === 'adhoc' ? (
          <>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Ad-hoc repair</div>
            <div style={{ fontSize: '12px', color: '#5f5e5a', marginTop: '6px', lineHeight: 1.5 }}>
              {adhocDescription || 'No ad-hoc description entered yet.'}
            </div>
          </>
        ) : selectedDiagnosis ? (
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedDiagnosis.repair_code}</div>
        ) : (
          <div style={{ fontSize: '13px', color: '#888780' }}>None selected</div>
        )}
      </div>

      {workflowMode === 'adhoc' && adhocLines.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Ad-hoc line items
          </div>
          {adhocLines.map(line => (
            <div key={line.items?.id ?? line.id} style={{ fontSize: '13px', padding: '3px 0' }}>
              {line.items?.name ?? 'Line item'}
              <span style={{ color: '#888780' }}> x{line.quantity}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Observations</div>
        <Row label="Tstat mode" value={tstatLabels[tstatMode] ?? tstatMode} />
        <Row label="Fan" value={tstatFan === 'auto' ? 'Auto' : tstatFan === 'on' ? 'On' : tstatFan} />
        <Row label="Outdoor" value={formatReading(tempOutdoor, 'F')} />
        <Row label="Return air" value={formatReading(tempReturn, 'F')} />
        <Row label="Supply air" value={formatReading(tempSupply, 'F')} />
        <Row label="Delta-T" value={formatDelta(tempReturn, tempSupply, tstatMode)} />
      </div>

      {observationCircuits.map(circuit => (
        <div key={circuit.circuit_number} style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Circuit {circuit.circuit_number}
          </div>
          <Row label="Suction" value={formatReading(circuit.suction_pressure, 'PSI')} />
          <Row label="SLT" value={formatReading(circuit.suction_line_temp, 'F')} />
          <Row label="Liquid" value={formatReading(circuit.liquid_pressure, 'PSI')} />
          <Row label="LLT" value={formatReading(circuit.liquid_line_temp, 'F')} />
        </div>
      ))}

      {addOns.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Additional work</div>
          {addOns.map(addOn => (
            <div key={addOn.id} style={{ fontSize: '13px', padding: '3px 0' }}>
              {addOn.type === 'bundle' ? addOn.repair_bundles?.name : addOn.items?.name}
              {addOn.quantity > 1 && <span style={{ color: '#888780' }}> x{addOn.quantity}</span>}
            </div>
          ))}
        </div>
      )}
        </>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Photos</div>
        <Row label="Observation" value={observationFiles.length > 0 ? `${observationFiles.length} photo${observationFiles.length > 1 ? 's' : ''}` : 'None'} />
        <Row label="Post-repair" value={postRepairFiles.length > 0 ? `${postRepairFiles.length} photo${postRepairFiles.length > 1 ? 's' : ''}` : 'None'} />
      </div>

      {diagnosisEstimateEligible && (
        <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Completion Path
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setCompletionPath('invoice')}
              style={{
                textAlign: 'left',
                borderRadius: '10px',
                border: completionPath === 'invoice' ? '1px solid #3b6d11' : '1px solid #e2e1da',
                background: completionPath === 'invoice' ? '#eef5ea' : '#fff',
                padding: '12px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a18' }}>Direct invoice review</div>
              <div style={{ fontSize: '12px', color: '#5f5e5a', marginTop: '4px', lineHeight: 1.5 }}>
                Use this when the repair is complete now and the job should move straight into owner invoice review.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCompletionPath('estimate')}
              style={{
                textAlign: 'left',
                borderRadius: '10px',
                border: completionPath === 'estimate' ? '1px solid #4152a3' : '1px solid #e2e1da',
                background: completionPath === 'estimate' ? '#eef1fd' : '#fff',
                padding: '12px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a18' }}>Estimate and follow-up</div>
              <div style={{ fontSize: '12px', color: '#5f5e5a', marginTop: '4px', lineHeight: 1.5 }}>
                Use this when the diagnosis is complete but the work needs an estimate, approval, and a return visit from the same job record.
              </div>
            </button>
          </div>
        </div>
      )}

      <div style={{
        background: '#faeeda',
        border: '1px solid #f5c97a',
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '20px',
        fontSize: '13px',
        color: '#633806',
      }}>
        {effectiveCompletionPath === 'estimate'
          ? 'This visit moves into estimate review. Owner/admin will generate the estimate PDF, send it from the same job, and track approval before follow-up work is scheduled.'
          : 'This job moves to owner review. The invoice will be finalized after the repair path is reviewed and approved.'}
      </div>

      {!canCloseJob && (
        <div style={{
          background: '#fcebeb',
          border: '1px solid #f7c1c1',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '12px',
          color: '#a32d2d',
          marginBottom: '14px',
        }}>
          {sharedWorkflowJob
            ? 'Complete the required shared workflow checklist items before closing the job.'
            : 'Select a diagnosis or save an ad-hoc repair before completing the job.'}
        </div>
      )}

      {error && (
        <div style={{
          background: '#fcebeb',
          border: '1px solid #f7c1c1',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '12px',
          color: '#a32d2d',
          marginBottom: '14px',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleClose}
        disabled={isPending || !canCloseJob}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '8px',
          border: 'none',
          background: (isPending || !canCloseJob) ? '#b4b2a9' : '#3b6d11',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          cursor: (isPending || !canCloseJob) ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
        >
        {isPending
          ? effectiveCompletionPath === 'estimate'
            ? 'Routing to estimate review...'
            : 'Completing job...'
          : effectiveCompletionPath === 'estimate'
            ? 'Complete visit to estimate review'
            : 'Complete job to invoice review'}
      </button>
    </div>
  )
}
