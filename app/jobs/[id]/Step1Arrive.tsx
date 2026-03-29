'use client'

import { useState, useTransition } from 'react'
import { HistoryJob, Job } from './types'
import { markArrived } from './actions'

interface Props {
  job: Job
  serviceHistory: HistoryJob[]
  onArrived: (arrivedAt: string, lat: number | null, lng: number | null) => void
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

const infoLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#888780',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '6px',
  fontWeight: 700,
}

const infoValueStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: '#1a1a18',
  lineHeight: 1.25,
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

export default function Step1Arrive({ job, serviceHistory, onArrived }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [detailsExpanded, setDetailsExpanded] = useState(false)

  const alreadyArrived = job.status === 'in_progress' && !!job.arrived_at
  const unitLabel = job.units?.name ?? job.manual_unit ?? ''
  const destinationLabel = [job.locations?.name, unitLabel].filter(Boolean).join(' - ')
  const equipmentLabel = [job.systems?.make, toTitleLabel(job.systems?.system_type) || job.systems?.system_subtype].filter(Boolean).join(' ')
  const contextCount = (job.problem_description ? 1 : 0) + serviceHistory.length

  function handleArrive() {
    setError(null)
    startTransition(async () => {
      const position = await getGps()
      const result = await markArrived(job.id, position?.lat ?? null, position?.lng ?? null)
      if (result.error) {
        setError(result.error)
      } else {
        onArrived(
          job.arrived_at ?? new Date().toISOString(),
          position?.lat ?? null,
          position?.lng ?? null,
        )
      }
    })
  }

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>
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
