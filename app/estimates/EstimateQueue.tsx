'use client'

import { useRouter } from 'next/navigation'
import { getCommercialStateMeta } from '@/utils/job-lifecycle'
import { EstimateQueueJob } from './types'

interface Props {
  jobs: EstimateQueueJob[]
}

function relativeTime(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '')

  if (sameDay) return `Today ${time}`
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

function firstEstimate(job: EstimateQueueJob) {
  return Array.isArray(job.job_estimates) ? (job.job_estimates[0] ?? null) : (job.job_estimates ?? null)
}

function firstPartsRequest(job: EstimateQueueJob) {
  return Array.isArray(job.job_parts_requests) ? (job.job_parts_requests[0] ?? null) : (job.job_parts_requests ?? null)
}

export default function EstimateQueue({ jobs }: Props) {
  const router = useRouter()

  return (
    <div style={{ padding: '16px', maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Estimate and parts</div>
          <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>
            Same-job commercial follow-through from estimate draft through parts and ready-to-schedule
          </div>
        </div>
        {jobs.length > 0 && (
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '5px',
            padding: '2px 8px',
            background: '#eef1fd',
            color: '#4152a3',
          }}>
            {jobs.length} job{jobs.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {jobs.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888780', padding: '20px 0' }}>
          No jobs are in the estimate lane right now.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {jobs.map(job => {
          const techName = job.users ? `${job.users.first_name} ${job.users.last_name.charAt(0)}.` : '-'
          const estimate = firstEstimate(job)
          const partsRequest = firstPartsRequest(job)
          const stateMeta = getCommercialStateMeta(job.commercial_state)

          return (
            <button
              key={job.id}
              type="button"
              onClick={() => router.push(`/estimates/${job.id}`)}
              style={{
                background: '#fff',
                border: '1px solid #e2e1da',
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a18', marginBottom: '2px' }}>
                {job.customers?.name ?? '-'} - {job.locations?.name ?? '-'}
                {job.manual_unit ? ` - ${job.manual_unit}` : job.units ? ` - ${job.units.name}` : ''}
              </div>
              <div style={{ fontSize: '11px', color: '#5f5e5a', marginBottom: '8px' }}>
                {job.diagnoses?.repair_code ?? 'Repair estimate'} - {techName}
                {estimate?.estimate_number ? ` - ${estimate.estimate_number}` : ''}
              </div>
              {partsRequest?.vendor_name && (
                <div style={{ fontSize: '11px', color: '#716a5e', marginBottom: '8px' }}>
                  Vendor: {partsRequest.vendor_name}
                  {partsRequest.eta_date ? ` - ETA ${partsRequest.eta_date}` : ''}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {stateMeta && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '999px',
                    padding: '3px 8px',
                    background: stateMeta.bg,
                    color: stateMeta.fg,
                  }}>
                    {stateMeta.label}
                  </span>
                )}
                {job.needs_admin_review && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '999px',
                    padding: '3px 8px',
                    background: '#faeeda',
                    color: '#854f0b',
                  }}>
                    needs review
                  </span>
                )}
                {estimate?.status && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '999px',
                    padding: '3px 8px',
                    background: '#f4f2ec',
                    color: '#5f5e5a',
                  }}>
                    {estimate.status}
                  </span>
                )}
                {partsRequest?.vendor_email_sent_at && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '999px',
                    padding: '3px 8px',
                    background: '#e6f1fb',
                    color: '#185fa5',
                  }}>
                    vendor emailed
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#b4b2a9' }}>
                  {relativeTime(partsRequest?.ready_to_schedule_at ?? partsRequest?.ordered_at ?? estimate?.sent_at ?? estimate?.generated_at ?? job.completed_at)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
