'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignJob } from '@/app/planning/actions'
import { JobCommercialState, JobResolutionType, JobStatus, getCommercialStateMeta, getPrimaryJobStateMeta, getResolutionTypeMeta } from '@/utils/job-lifecycle'

export interface ListJob {
  id: string
  job_status: JobStatus
  resolution_type: JobResolutionType | null
  commercial_state: JobCommercialState
  status: string
  priority: string
  manual_unit: string | null
  problem_description: string | null
  queue_position: number | null
  arrived_at: string | null
  access_confirmation_needed: boolean
  customers: { name: string } | null
  locations: { name: string } | null
  diagnoses: { repair_code: string } | null
}

export interface UnassignedJob {
  id: string
  job_status: JobStatus
  resolution_type: JobResolutionType | null
  commercial_state: JobCommercialState
  status: string
  priority: string
  manual_unit: string | null
  problem_description: string | null
  customers: { name: string } | null
  locations: { name: string } | null
}

export interface Tech {
  id: string
  first_name: string
  last_name: string
}

export interface Customer {
  id: string
  name: string
  type: string | null
}

export interface Location {
  id: string
  name: string
  customer_id: string
}

interface Props {
  myJobs: ListJob[]
  doneJobs: ListJob[]
  recentClosedJobs: ListJob[]
  unassignedJobs: UnassignedJob[]
  techs: Tech[]
  customers: Customer[]
  locations: Location[]
  userId: string
  addJobAction: (formData: FormData) => Promise<{ error?: string; success?: boolean }>
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function useElapsed(arrivedAt: string | null) {
  const [s, setS] = useState(0)
  useEffect(() => {
    if (!arrivedAt) return
    const start = new Date(arrivedAt).getTime()
    const tick = () => setS(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [arrivedAt])
  return s
}

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dotColor(p: string) {
  if (p === 'emergency') return '#e24b4a'
  if (p === 'urgent')    return '#ef9f27'
  return '#b4b2a9'
}

// ── Active timer card (separate so hook is called unconditionally) ─────────────

function ActiveJobCard({ job, onClick }: { job: ListJob; onClick: () => void }) {
  const elapsed = useElapsed(job.arrived_at)
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e2e1da', borderLeft: '3px solid #ef9f27',
        borderRadius: '8px', padding: '12px 14px', cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor(job.priority), flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>{job.customers?.name ?? '—'}</span>
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#854f0b', fontWeight: 600 }}>{fmt(elapsed)}</span>
      </div>
      <div style={{ fontSize: '12px', color: '#5f5e5a', marginBottom: '2px' }}>
        {job.locations?.name ?? '—'}{job.manual_unit ? ` · ${job.manual_unit}` : ''}
      </div>
      <div style={{ fontSize: '11px', color: '#888780' }}>
        {job.diagnoses?.repair_code ?? job.problem_description ?? '—'}
      </div>
      <div style={{ marginTop: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px', background: '#faeeda', color: '#854f0b' }}>on site</span>
      </div>
    </div>
  )
}

// ── Plain job card ────────────────────────────────────────────────────────────

function JobCard({ job, done, onClick }: { job: ListJob; done?: boolean; onClick: () => void }) {
  const primaryState = getPrimaryJobStateMeta(job.job_status, job.commercial_state, job.resolution_type)
  const resolutionMeta = job.resolution_type ? getResolutionTypeMeta(job.resolution_type) : null
  const commercialMeta = job.commercial_state !== 'none' ? getCommercialStateMeta(job.commercial_state) : null

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px',
        padding: '12px 14px', cursor: 'pointer', opacity: done ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor(job.priority), flexShrink: 0 }} />
        <span style={{ fontWeight: done ? 400 : 600, fontSize: '13px', flex: 1, textDecoration: done ? 'line-through' : 'none' }}>
          {job.customers?.name ?? '—'}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: '#5f5e5a', marginBottom: '2px' }}>
        {job.locations?.name ?? '—'}{job.manual_unit ? ` · ${job.manual_unit}` : ''}
      </div>
      <div style={{ fontSize: '11px', color: '#888780' }}>
        {job.diagnoses?.repair_code ?? job.problem_description ?? '—'}
      </div>
      <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px', background: primaryState.bg, color: primaryState.fg }}>
          {primaryState.label}
        </span>
        {resolutionMeta && job.job_status !== 'completed' && (
          <span style={{ fontSize: '10px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px', background: resolutionMeta.bg, color: resolutionMeta.fg }}>
            {resolutionMeta.label}
          </span>
        )}
        {commercialMeta && job.commercial_state !== 'none' && job.commercial_state !== 'invoiced' && (
          <span style={{ fontSize: '10px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px', background: commercialMeta.bg, color: commercialMeta.fg }}>
            {commercialMeta.label}
          </span>
        )}
      </div>
    </div>
  )
}

function AddJobModal({
  techs,
  customers,
  locations,
  onClose,
  addJobAction,
}: {
  techs: Tech[]
  customers: Customer[]
  locations: Location[]
  onClose: () => void
  addJobAction: (formData: FormData) => Promise<{ error?: string; success?: boolean }>
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [accessNeeded, setAccessNeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredLocations = locations.filter(location => location.customer_id === selectedCustomerId)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set('access_confirmation_needed', accessNeeded ? 'true' : 'false')

    startTransition(async () => {
      const result = await addJobAction(formData)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '14px',
        padding: '24px',
        width: '500px',
        maxWidth: '94vw',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Add job</div>
        <div style={{ fontSize: '12px', color: '#888780', marginBottom: '20px' }}>
          Internal entry for today. Assign it now or leave it unassigned for the queue.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Customer *</label>
            <select
              name="customer_id"
              required
              style={inputStyle}
              value={selectedCustomerId}
              onChange={event => setSelectedCustomerId(event.target.value)}
            >
              <option value="">- select customer -</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Location *</label>
              <select
                name="location_id"
                required
                style={inputStyle}
                disabled={!selectedCustomerId}
              >
                <option value="">- select location -</option>
                {filteredLocations.map(location => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <input name="unit" type="text" placeholder="Apt / suite / free-text" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <select name="priority" style={inputStyle} defaultValue="routine">
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assign to</label>
              <select name="assigned_tech" style={inputStyle}>
                <option value="">- unassigned -</option>
                {techs.map(tech => (
                  <option key={tech.id} value={tech.id}>{tech.first_name} {tech.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Problem description</label>
            <textarea
              name="problem_description"
              rows={3}
              placeholder="What's the issue?"
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#eeedfe',
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '20px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#3c3489',
          }}>
            <input
              type="checkbox"
              checked={accessNeeded}
              onChange={event => setAccessNeeded(event.target.checked)}
              style={{ marginTop: '2px', flexShrink: 0 }}
            />
            Confirm someone will be present to provide access if this is a secured or distant site.
          </label>

          {error && (
            <div style={{
              background: '#fcebeb',
              border: '1px solid #f7c1c1',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#a32d2d',
              marginBottom: '14px',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={buttonStyle}>Cancel</button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                ...buttonStyle,
                background: isPending ? '#b4b2a9' : '#185fa5',
                color: '#fff',
                border: 'none',
                minWidth: '100px',
              }}
            >
              {isPending ? 'Creating...' : 'Create job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#5f5e5a',
  display: 'block',
  marginBottom: '4px',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '13px',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #d3d1c7',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const buttonStyle: React.CSSProperties = {
  fontSize: '13px',
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid #d3d1c7',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function JobList({
  myJobs,
  doneJobs,
  recentClosedJobs,
  unassignedJobs,
  techs,
  customers,
  locations,
  userId,
  addJobAction,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pullingId, setPullingId] = useState<string | null>(null)
  const [showAddJob, setShowAddJob] = useState(false)

  const activeJob = myJobs.find(j => j.job_status === 'on_site' || j.job_status === 'follow_up_active') ?? null
  const queuedJobs = myJobs.filter(j => j.job_status !== 'on_site' && j.job_status !== 'follow_up_active')

  function handlePull(jobId: string) {
    setPullingId(jobId)
    startTransition(async () => {
      await assignJob(jobId, userId)
      setPullingId(null)
      router.refresh()
    })
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>My jobs</div>
            <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>{today}</div>
          </div>
          <button
            onClick={() => setShowAddJob(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: '1px solid #185fa5',
              background: '#185fa5',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            Add Job
          </button>
        </div>
      </div>

      {/* Done jobs */}
      {doneJobs.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Done ({doneJobs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {doneJobs.map(j => (
              <JobCard key={j.id} job={j} done onClick={() => router.push(`/jobs/${j.id}`)} />
            ))}
          </div>
        </div>
      )}

      {recentClosedJobs.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Recent closed ({recentClosedJobs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentClosedJobs.map(j => (
              <JobCard key={j.id} job={j} done onClick={() => router.push(`/jobs/${j.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Active job */}
      {activeJob && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#854f0b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Active — on site
          </div>
          <ActiveJobCard job={activeJob} onClick={() => router.push(`/jobs/${activeJob.id}`)} />
        </div>
      )}

      {/* Queued jobs */}
      {queuedJobs.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Up next ({queuedJobs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {queuedJobs.map(j => (
              <JobCard key={j.id} job={j} onClick={() => router.push(`/jobs/${j.id}`)} />
            ))}
          </div>
        </div>
      )}

      {myJobs.length === 0 && doneJobs.length === 0 && recentClosedJobs.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888780', padding: '20px 0' }}>
          No jobs assigned for today.
        </div>
      )}

      {/* Unassigned rail */}
      {unassignedJobs.length > 0 && (
        <div style={{ borderTop: '1px solid #e2e1da', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Unassigned jobs</div>
            <span style={{ fontSize: '11px', fontWeight: 700, borderRadius: '5px', padding: '2px 8px', background: '#fcebeb', color: '#a32d2d' }}>
              {unassignedJobs.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {unassignedJobs.map(j => (
              <div
                key={j.id}
                style={{
                  background: '#fff',
                  border: j.priority !== 'routine' ? '1px solid #fac775' : '1px solid #e2e1da',
                  borderRadius: '8px', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>{j.customers?.name ?? '—'}</div>
                  <div style={{ fontSize: '12px', color: '#5f5e5a' }}>
                    {j.locations?.name ?? '—'}{j.manual_unit ? ` · ${j.manual_unit}` : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888780', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {j.problem_description ?? '—'}
                  </div>
                </div>
                <button
                  onClick={() => handlePull(j.id)}
                  disabled={isPending && pullingId === j.id}
                  style={{
                    padding: '7px 14px', borderRadius: '6px', border: '1px solid #d3d1c7',
                    background: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                    color: '#185fa5', fontWeight: 600, flexShrink: 0,
                  }}
                >
                  {isPending && pullingId === j.id ? '…' : 'Pull'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddJob && (
        <AddJobModal
          techs={techs}
          customers={customers}
          locations={locations}
          onClose={() => {
            setShowAddJob(false)
            router.refresh()
          }}
          addJobAction={addJobAction}
        />
      )}

    </div>
  )
}
