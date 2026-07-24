'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  jobId: string
  customerName: string | null
  locationName: string | null
  unitName: string | null
  arrivedAt: string | null
  jobStatus: string
  commercialState: string
  resolutionType: string | null
  tstatMode: string | null
  tstatFan: string | null
  diagnosisId: string | null
  hasAdhocBundle: boolean
  hasWorkflow: boolean
}

function useElapsed(arrivedAt: string | null) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (!arrivedAt) return
    const start = new Date(arrivedAt).getTime()
    const tick = () => setSecs(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [arrivedAt])

  return secs
}

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

const STEPS = [
  { key: 'arrive', label: 'Arrive' },
  { key: 'observe', label: 'Observe' },
  { key: 'diagnose', label: 'Diagnose' },
  { key: 'work', label: 'Work' },
  { key: 'close', label: 'Close' },
]

function stepComplete(
  stepKey: string,
  jobStatus: string,
  tstatMode: string | null,
  tstatFan: string | null,
  diagnosisId: string | null,
  hasAdhocBundle: boolean,
) {
  const arrivedStatuses = ['on_site', 'follow_up_active', 'completed', 'invoiced']
  switch (stepKey) {
    case 'arrive':
      return arrivedStatuses.includes(jobStatus)
    case 'observe':
      return !!tstatMode && !!tstatFan
    case 'diagnose':
      return !!diagnosisId || hasAdhocBundle
    case 'work':
      return !!diagnosisId || hasAdhocBundle
    case 'close':
      return jobStatus === 'completed' || jobStatus === 'invoiced'
    default:
      return false
  }
}

export default function JobHeader({
  jobId,
  customerName,
  locationName,
  unitName,
  arrivedAt,
  jobStatus,
  commercialState,
  resolutionType,
  tstatMode,
  tstatFan,
  diagnosisId,
  hasAdhocBundle,
  hasWorkflow,
}: Props) {
  const pathname = usePathname()
  const elapsed = useElapsed(arrivedAt)

  const currentStep = STEPS.find(s => pathname.endsWith(`/${s.key}`))?.key ?? 'arrive'
  const titleParts = [customerName, locationName, unitName].filter(Boolean)
  const title = titleParts.length > 0 ? titleParts.join(' · ') : 'Job'

  const steps = hasWorkflow
    ? [
        { key: 'arrive', label: 'Arrive' },
        { key: 'observe', label: 'Prep' },
        { key: 'diagnose', label: 'Execute' },
        { key: 'work', label: 'Messages' },
        { key: 'close', label: 'Close' },
      ]
    : STEPS

  return (
    <header style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e2e1da' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 16px' }}>
        <Link
          href="/jobs"
          style={{
            fontSize: '13px',
            color: '#185fa5',
            textDecoration: 'none',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {'<- Jobs'}
        </Link>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#1a1a18',
          }}>
            {title}
          </div>
        </div>

        <span style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          color: arrivedAt ? '#854f0b' : '#b4b2a9',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {arrivedAt ? fmt(elapsed) : '--:--:--'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0', borderTop: '1px solid #e2e1da' }}>
        {steps.map(step => {
          const active = currentStep === step.key
          const complete = !active && stepComplete(step.key, jobStatus, tstatMode, tstatFan, diagnosisId, hasAdhocBundle)
          const clickable = complete || active

          return (
            <Link
              key={step.key}
              href={`/jobs/${jobId}/${step.key}`}
              style={{
                flex: 1,
                padding: '8px 2px',
                borderBottom: active ? '2px solid #185fa5' : '2px solid transparent',
                fontSize: '10px',
                fontWeight: active ? 700 : 400,
                color: active ? '#185fa5' : complete ? '#3b6d11' : '#b4b2a9',
                textDecoration: 'none',
                textAlign: 'center',
                pointerEvents: clickable ? 'auto' : 'none',
                fontFamily: 'inherit',
              }}
            >
              {complete ? '✓ ' : ''}{step.label}
            </Link>
          )
        })}
      </div>
    </header>
  )
}
