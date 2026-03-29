'use client'

import { useRouter } from 'next/navigation'
import { InvoiceQueueJob } from './types'

interface Props {
  jobs: InvoiceQueueJob[]
  blockerMap: Record<string, boolean>
}

function relativeTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '')

  if (sameDay) return `Today ${time}`
  if (isYesterday) return `Yesterday ${time}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`
}

export default function InvoiceQueue({ jobs, blockerMap }: Props) {
  const router = useRouter()

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Invoice review</div>
          <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>Jobs pending management approval</div>
        </div>
        {jobs.length > 0 && (
          <span style={{
            fontSize: '11px', fontWeight: 700, borderRadius: '5px',
            padding: '2px 8px', background: '#fcebeb', color: '#a32d2d',
          }}>
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Job cards */}
      {jobs.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888780', padding: '20px 0' }}>
          No jobs pending review.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {jobs.map(job => {
          const techName = job.users
            ? `${job.users.first_name} ${job.users.last_name.charAt(0)}.`
            : '—'
          const needsCost = blockerMap[job.id] ?? false
          const flagged = job.flagged_for_review

          return (
            <div
              key={job.id}
              onClick={() => router.push(`/invoices/${job.id}`)}
              style={{
                background: '#fff',
                border: '1px solid #e2e1da',
                borderRadius: '8px',
                padding: '12px 14px',
                cursor: 'pointer',
              }}
            >
              {/* Customer + location */}
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                {job.customers?.name ?? '—'}
                {' — '}
                {job.locations?.name ?? ''}
                {job.manual_unit ? ` · ${job.manual_unit}` : job.units ? ` · ${(job.units as any).name}` : ''}
              </div>

              {/* Diagnosis + tech */}
              <div style={{ fontSize: '11px', color: '#5f5e5a', marginBottom: '5px' }}>
                {job.diagnoses?.repair_code ?? '—'} · {techName}
              </div>

              {/* Pills + time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                {flagged ? (
                  <span style={{
                    fontSize: '10px', fontWeight: 600, borderRadius: '4px',
                    padding: '2px 7px', background: '#fcebeb', color: '#a32d2d',
                  }}>
                    flagged
                  </span>
                ) : (
                  <span style={{
                    fontSize: '10px', fontWeight: 600, borderRadius: '4px',
                    padding: '2px 7px', background: '#faeeda', color: '#854f0b',
                  }}>
                    pending
                  </span>
                )}
                {needsCost && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600, borderRadius: '4px',
                    padding: '2px 7px', background: '#fcebeb', color: '#a32d2d',
                  }}>
                    needs cost entry
                  </span>
                )}
                <span style={{ fontSize: '10px', color: '#b4b2a9', marginLeft: 'auto' }}>
                  {relativeTime(job.completed_at)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
