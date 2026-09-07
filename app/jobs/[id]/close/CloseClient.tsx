'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DiagnosisItem, Job, JobAddOn, JobCrewMember, JobMessage, JobWorkflow } from '../types'
import { closeJob, saveJobChecklistItemNote, setJobChecklistItemStatus, updateJobWorkflowStatus } from '../actions'

interface Props {
  job: Job
  workflow: JobWorkflow | null
  crewMembers: JobCrewMember[]
  jobMessages: JobMessage[]
  workflowMode: 'diagnosis' | 'adhoc'
  selectedDiagnosis: DiagnosisItem | null
  addOns: JobAddOn[]
}

type CompletionPath = 'invoice' | 'estimate'

function getGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 5000 })
  })
}

function safeFileName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '_') }

async function uploadPhotos(jobId: string, type: string, files: File[]) {
  if (!files.length) return
  const { createClient } = await import('@/utils/supabase/client')
  const supabase = createClient()
  const results = await Promise.all(files.map(async (file, i) => {
    const path = `${jobId}/${type}/${Date.now()}-${i}-${safeFileName(file.name)}`
    const { error } = await supabase.storage.from('job-photos').upload(path, file, { upsert: false })
    return { fileName: file.name, error }
  }))
  const failures = results.filter(r => r.error)
  if (failures.length > 0) throw new Error(`Photo upload failed for: ${failures.map(r => r.fileName).join(', ')}`)
}


export default function CloseClient({ job, workflow, crewMembers, jobMessages, workflowMode, selectedDiagnosis, addOns }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isChecklistPending, startChecklistTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [completionPath, setCompletionPath] = useState<CompletionPath>('invoice')
  const [observationFiles] = useState<File[]>([])
  const [postRepairFiles] = useState<File[]>([])
  const router = useRouter()

  const sharedWorkflowJob = workflow != null
  const workflowRequiredItems = workflow?.job_workflow_items.filter(i => i.required) ?? []
  const completedWorkflowItems = workflowRequiredItems.filter(i => i.completed).length
  const workflowReadyToClose = sharedWorkflowJob && workflowRequiredItems.every(i => i.completed)
  const hasDiagnosisPath = workflowMode === 'diagnosis' && !!selectedDiagnosis
  const hasAdhocPath = workflowMode === 'adhoc' && !!(job.adhoc_bundle?.tech_description?.trim())
  const canCloseJob = sharedWorkflowJob ? workflowReadyToClose : (hasDiagnosisPath || !!job.adhoc_bundle || hasAdhocPath)
  const diagnosisEstimateEligible = !sharedWorkflowJob && workflowMode === 'diagnosis' && !!selectedDiagnosis
  const effectiveCompletionPath: CompletionPath = diagnosisEstimateEligible ? completionPath : 'invoice'

  const closeoutItems = useMemo(
    () => (workflow?.job_workflow_items ?? []).filter(i => i.phase === 'closeout').sort((a, b) => a.sort_order - b.sort_order),
    [workflow],
  )

  function handleChecklistAction(task: () => Promise<{ error?: string | null }>) {
    setError(null)
    startChecklistTransition(async () => {
      const result = await task()
      if (result.error) { setError(result.error); return }
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
        if (result.error) { setError(result.error) } else { router.push('/jobs') }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Photo upload failed.')
      }
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {sharedWorkflowJob && (
          <>
            <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Shared Workflow</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{workflow!.workflow_type === 'install' ? 'Install' : 'Major Repair'}</div>
              <div style={{ fontSize: '12px', color: '#5f5e5a', marginTop: '6px' }}>{completedWorkflowItems} of {workflowRequiredItems.length} required items complete</div>
              {workflow!.status !== 'closeout' && workflow!.status !== 'complete' && (
                <button type="button" onClick={() => handleChecklistAction(() => updateJobWorkflowStatus(job.id, 'closeout'))} disabled={isChecklistPending} style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '9px', border: '1px solid #d3d1c7', background: '#fff', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', cursor: isChecklistPending ? 'not-allowed' : 'pointer' }}>Move to Closeout</button>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Crew</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {crewMembers.map(m => (
                  <span key={`${m.id}-${m.assignment_role}`} style={{ borderRadius: '999px', background: '#f1efe8', color: '#1a1a18', padding: '6px 10px', fontSize: '12px', fontWeight: 600 }}>
                    {[m.first_name, m.last_name].filter(Boolean).join(' ')}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Message Activity</div>
              <div style={{ fontSize: '13px', color: '#1a1a18' }}>{jobMessages.length} shared update{jobMessages.length === 1 ? '' : 's'} captured</div>
            </div>

            {closeoutItems.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Completion Checklist</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {closeoutItems.map(item => (
                    <div key={item.id} style={{ border: '1px solid #ece8de', borderRadius: '8px', padding: '10px 12px', background: item.completed ? '#f4fbef' : '#fcfbf8' }}>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a18' }}>{item.label}</div>
                          {item.details && <div style={{ fontSize: '12px', color: '#716a5e', marginTop: '4px', lineHeight: 1.45 }}>{item.details}</div>}
                        </div>
                        <button type="button" onClick={() => handleChecklistAction(() => setJobChecklistItemStatus(item.id, !item.completed))} disabled={isChecklistPending} style={{ padding: '6px 10px', borderRadius: '999px', border: item.completed ? '1px solid #9cca72' : '1px solid #d3d1c7', background: item.completed ? '#eaf3de' : '#fff', color: item.completed ? '#31590f' : '#5f5e5a', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit', cursor: isChecklistPending ? 'not-allowed' : 'pointer' }}>{item.completed ? 'Done' : 'Mark Done'}</button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <input type="text" value={noteDrafts[item.id] ?? item.note ?? ''} onChange={e => setNoteDrafts(c => ({ ...c, [item.id]: e.target.value }))} placeholder="Add completion note" style={{ flex: 1, fontSize: '12px', padding: '8px 10px', borderRadius: '9px', border: '1px solid #d7d4ca', background: '#fff', fontFamily: 'inherit' }} />
                        <button type="button" onClick={() => handleChecklistAction(() => saveJobChecklistItemNote(item.id, noteDrafts[item.id] ?? item.note ?? ''))} disabled={isChecklistPending} style={{ padding: '8px 12px', borderRadius: '9px', border: '1px solid #d3d1c7', background: '#fff', fontSize: '12px', fontFamily: 'inherit', cursor: isChecklistPending ? 'not-allowed' : 'pointer' }}>Save</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!sharedWorkflowJob && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6960', marginBottom: '8px' }}>Almost done</div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15 }}>How did it go?</h1>
            <p style={{ margin: '12px 0 0', fontSize: '17px', color: '#6b6960', lineHeight: 1.45 }}>
              {workflowMode === 'adhoc'
                ? (job.adhoc_bundle?.tech_description || 'Ad-hoc repair on file.')
                : (selectedDiagnosis?.repair_code || 'No diagnosis selected yet.')}
              {addOns.length > 0 ? ` · ${addOns.length} extra ${addOns.length === 1 ? 'item' : 'items'}` : ''}
            </p>
          </div>
        )}

        {diagnosisEstimateEligible && (
          <div style={{ display: 'grid', gap: '10px', marginBottom: '28px' }}>
            <button type="button" onClick={() => setCompletionPath('invoice')} style={{ textAlign: 'left', borderRadius: '16px', border: completionPath === 'invoice' ? '2px solid #1a1a18' : '1px solid #e4e2d8', background: completionPath === 'invoice' ? '#fff' : 'transparent', padding: '16px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a18' }}>Fixed today</div>
              <div style={{ fontSize: '14px', color: '#6b6960', marginTop: '4px', lineHeight: 1.45 }}>Office will invoice it.</div>
            </button>
            <button type="button" onClick={() => setCompletionPath('estimate')} style={{ textAlign: 'left', borderRadius: '16px', border: completionPath === 'estimate' ? '2px solid #1a1a18' : '1px solid #e4e2d8', background: completionPath === 'estimate' ? '#fff' : 'transparent', padding: '16px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a18' }}>Needs an estimate</div>
              <div style={{ fontSize: '14px', color: '#6b6960', marginTop: '4px', lineHeight: 1.45 }}>Office will price it and send it out.</div>
            </button>
          </div>
        )}

        {!canCloseJob && (
          <div style={{ background: '#fcebeb', border: '1px solid #f7c1c1', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: '#a32d2d', marginBottom: '14px' }}>
            {sharedWorkflowJob ? 'Complete required checklist items before closing.' : 'Select a diagnosis or save an ad-hoc repair first.'}
          </div>
        )}

        {error && (
          <div style={{ background: '#fcebeb', border: '1px solid #f7c1c1', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: '#a32d2d', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleClose}
          disabled={isPending || !canCloseJob}
          style={{
            width: '100%', padding: '18px', borderRadius: '16px', border: 'none',
            background: (isPending || !canCloseJob) ? '#b4b2a9' : '#1a1a18',
            color: '#f5f4f0', fontSize: '18px', fontWeight: 600,
            cursor: (isPending || !canCloseJob) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            marginBottom: '16px',
          }}
        >
          {isPending ? 'Wrapping…' : 'Wrap this up'}
        </button>
      </div>
    </div>
  )
}
