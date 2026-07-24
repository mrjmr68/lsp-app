'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HistoryJob, Job, JobCrewMember, JobWorkflow } from '../types'
import { addJobMessage, markArrived, startJobWorkflow } from '../actions'
import { JobWorkflowType } from '@/utils/job-workflows'

interface Props {
  viewerRole: 'tech' | 'dispatcher' | 'admin' | 'owner' | null
  job: Job
  serviceHistory: HistoryJob[]
  workflow: JobWorkflow | null
  crewMembers: JobCrewMember[]
}

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

function formatJobDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toTitleLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : ''
}

const infoCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e1da',
  borderRadius: '12px',
  padding: '16px 18px',
  marginBottom: '14px',
}

const inlineLabelStyle: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: 700,
  color: '#1a1a18',
  display: 'inline-block',
  marginRight: '1.25em',
}

const inlineContentStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 500,
  color: '#1a1a18',
}

export default function ArriveClient({ viewerRole, job, serviceHistory, workflow, crewMembers }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isWorkflowPending, startWorkflowTransition] = useTransition()
  const [isMessagePending, startMessageTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const router = useRouter()

  const alreadyArrived = (job.job_status === 'on_site' || job.job_status === 'follow_up_active') && !!job.arrived_at
  const unitLabel = job.units?.name ?? job.manual_unit ?? ''
  const destinationLabel = [job.locations?.name, unitLabel].filter(Boolean).join(' - ')
  const equipmentLabel = [job.systems?.make, toTitleLabel(job.systems?.system_type) || job.systems?.system_subtype].filter(Boolean).join(' ')
  const canStartWorkflow = !workflow && ['owner', 'admin', 'dispatcher'].includes(viewerRole ?? '')

  function handleStartWorkflow(workflowType: JobWorkflowType) {
    setError(null)
    startWorkflowTransition(async () => {
      const result = await startJobWorkflow(job.id, workflowType)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleArrive() {
    setError(null)
    startTransition(async () => {
      const position = await getGps()
      const result = await markArrived(job.id, position?.lat ?? null, position?.lng ?? null)
      if (result.error) {
        setError(result.error)
      } else {
        const locationName = job.locations?.name ?? 'site'
        setMessageBody(`On site at ${locationName}`)
        setShowComposer(true)
      }
    })
  }

  function handleSendMessage() {
    startMessageTransition(async () => {
      if (messageBody.trim()) {
        const result = await addJobMessage(job.id, messageBody.trim())
        if (result.error) {
          setError(result.error)
          return
        }
      }
      router.push(`/jobs/${job.id}/observe`)
    })
  }

  function handleSkipMessage() {
    router.push(`/jobs/${job.id}/observe`)
  }

  if (showComposer) {
    return (
      <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{
          background: '#eaf3de',
          border: '1px solid #b8dcb8',
          borderRadius: '10px',
          padding: '14px 16px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#3b6d11',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: '20px',
        }}>
          On-site
        </div>

        <div style={infoCardStyle}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#888780',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '10px',
          }}>
            Notify the office
          </div>
          <div style={{
            fontSize: '13px',
            color: '#5f5e5a',
            lineHeight: 1.5,
            marginBottom: '12px',
          }}>
            Send a quick message to let the office know you've arrived. Edit the text below or send as-is.
          </div>
          <textarea
            value={messageBody}
            onChange={event => setMessageBody(event.target.value)}
            rows={3}
            style={{
              width: '100%',
              fontSize: '14px',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid #d3d1c7',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />

          {error && (
            <div style={{
              background: '#fcebeb',
              border: '1px solid #f7c1c1',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#a32d2d',
              marginTop: '10px',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button
              type="button"
              onClick={handleSkipMessage}
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid #d3d1c7',
                background: '#fff',
                color: '#5f5e5a',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={isMessagePending}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: isMessagePending ? '#b4b2a9' : '#185fa5',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isMessagePending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {isMessagePending ? 'Sending...' : 'Send & continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', overflowY: 'auto', flex: 1 }}>
      <div style={{
        background: 'linear-gradient(180deg, #35393f 0%, #22262c 100%)',
        border: '1px solid #171a1f',
        borderRadius: '14px',
        padding: '14px 16px',
        marginBottom: '14px',
        boxShadow: '0 16px 32px rgba(18, 22, 28, 0.18)',
      }}>
        <div style={{
          fontSize: '11px',
          color: '#d4c49d',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '6px',
          fontWeight: 700,
        }}>
          Destination
        </div>
        <div style={{ fontSize: '18px', lineHeight: 1.2, fontWeight: 700, color: '#fff8e7' }}>
          {destinationLabel || job.locations?.name || 'Current stop'}
        </div>
      </div>

      {job.locations?.access_notes && (
        <div style={infoCardStyle}>
          <div>
            <span style={inlineLabelStyle}>Access:</span>
            <span style={inlineContentStyle}>{job.locations.access_notes}</span>
          </div>
        </div>
      )}

      <div style={infoCardStyle}>
        <div>
          <span style={inlineLabelStyle}>Equipment:</span>
          <span style={inlineContentStyle}>{equipmentLabel || 'No equipment linked yet'}</span>
        </div>
      </div>

      <div style={{
        ...infoCardStyle,
        marginBottom: '20px',
        overflow: 'hidden',
        padding: 0,
      }}>
        <button
          type="button"
          onClick={() => setDetailsExpanded(current => !current)}
          style={{
            width: '100%',
            padding: '16px 18px',
            border: 'none',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a18' }}>
              Context
            </div>
          </div>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#1a1a18',
            padding: '4px 10px',
            border: '1px solid #d3d1c7',
            borderRadius: '8px',
            lineHeight: 1,
            background: '#fff',
          }}>
            {detailsExpanded ? 'Close' : 'Open'}
          </div>
        </button>

        {detailsExpanded && (
          <div style={{ borderTop: '1px solid #eee8d8', padding: '14px 18px 16px' }}>
            <div style={{ marginBottom: serviceHistory.length > 0 ? '14px' : 0 }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#888780',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '6px',
              }}>
                Complaint
              </div>
              <div style={{
                fontSize: '14px',
                color: job.problem_description ? '#1a1a18' : '#888780',
                lineHeight: 1.5,
                fontWeight: 500,
              }}>
                {job.problem_description || 'No reported problem was entered for this call.'}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#888780',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                Previous Visits {serviceHistory.length > 0 ? `(${serviceHistory.length})` : ''}
              </div>

              {serviceHistory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {serviceHistory.map(historyJob => (
                    <div
                      key={historyJob.id}
                      style={{
                        background: '#faf8f1',
                        border: '1px solid #e2e1da',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#888780', flexShrink: 0 }}>
                        {formatJobDate(historyJob.job_date)}
                      </div>
                      <div style={{ fontSize: '13px', flex: 1, color: '#1a1a18', fontWeight: 500 }}>
                        {historyJob.diagnoses?.repair_code ?? historyJob.manual_unit ?? '-'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#888780' }}>
                  No prior service history for this system.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {(workflow || canStartWorkflow) && (
        <div style={infoCardStyle}>
          <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 700 }}>
            Shared Crew Workflow
          </div>
          {workflow ? (
            <>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a18' }}>
                {workflow.workflow_type === 'install' ? 'Install' : 'Major Repair'}
              </div>
              <div style={{ fontSize: '13px', color: '#5f5e5a', marginTop: '6px' }}>
                {crewMembers.length > 0 ? `${crewMembers.length} crew member${crewMembers.length === 1 ? '' : 's'} synced` : 'Shared workspace is active.'}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '14px', color: '#1a1a18', marginBottom: '12px', lineHeight: 1.45 }}>
                Start the shared workflow before travel so prep, materials, and field check-ins stay synced for the whole crew.
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleStartWorkflow('install')}
                  disabled={isWorkflowPending}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #d3d1c7',
                    background: '#fff',
                    color: '#1a1a18',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isWorkflowPending ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isWorkflowPending ? 'Starting...' : 'Start Install'}
                </button>
                <button
                  type="button"
                  onClick={() => handleStartWorkflow('major_repair')}
                  disabled={isWorkflowPending}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #d3d1c7',
                    background: '#fff',
                    color: '#1a1a18',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isWorkflowPending ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isWorkflowPending ? 'Starting...' : 'Start Major Repair'}
                </button>
              </div>
            </>
          )}
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

      {alreadyArrived ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{
            background: '#eaf3de',
            border: '1px solid #b8dcb8',
            borderRadius: '10px',
            padding: '14px 16px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#3b6d11',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            On-site
          </div>
          <button
            type="button"
            onClick={() => router.push(`/jobs/${job.id}/observe`)}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '10px',
              border: 'none',
              background: '#185fa5',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {'Observe ->'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleArrive}
          disabled={isPending}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '10px',
            border: 'none',
            background: isPending ? '#b4b2a9' : '#185fa5',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 700,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          {isPending ? 'Recording arrival...' : 'On-Site'}
        </button>
      )}
    </div>
  )
}
