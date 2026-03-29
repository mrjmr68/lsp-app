'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { assignJob, toggleAccessConfirmed } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Job {
  id: string
  status: string
  priority: string
  manual_unit: string | null
  problem_description: string | null
  queue_position: number | null
  access_confirmation_needed: boolean
  access_confirmed: boolean
  assigned_tech: string | null
  job_date: string
  locations: { name: string } | null
  customers: { name: string } | null
  diagnoses: { repair_code: string } | null
}

interface Tech {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface Customer {
  id: string
  name: string
  type: string
}

interface Location {
  id: string
  name: string
  customer_id: string
}

interface Props {
  jobs: Job[]
  techs: Tech[]
  techsDiagnostic?: string | null
  customers: Customer[]
  locations: Location[]
  today: string
  addJobAction: (formData: FormData) => Promise<{ error?: string; success?: boolean }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(t: Tech) {
  return (t.first_name[0] + t.last_name[0]).toUpperCase()
}

const avatarColors = [
  { bg: '#b5d4f4', fg: '#0c447c' },
  { bg: '#9fe1cb', fg: '#085041' },
  { bg: '#fac775', fg: '#633806' },
  { bg: '#cecbf6', fg: '#3c3489' },
  { bg: '#f4b8c1', fg: '#7a1a2e' },
  { bg: '#b8e6b8', fg: '#1a5c1a' },
]
function avatarColor(i: number) { return avatarColors[i % avatarColors.length] }

function statusPill(status: string) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    new:                 { bg: '#f1efe8', fg: '#5f5e5a', label: 'new'          },
    assigned:            { bg: '#eaf3de', fg: '#3b6d11', label: 'assigned'     },
    en_route:            { bg: '#e6f1fb', fg: '#185fa5', label: 'en route'     },
    in_progress:         { bg: '#faeeda', fg: '#854f0b', label: 'on site'      },
    completed:           { bg: '#f1efe8', fg: '#5f5e5a', label: 'completed'    },
    closed_no_diagnosis: { bg: '#eeedfe', fg: '#3c3489', label: 'no diagnosis' },
  }
  return map[status] ?? { bg: '#f1efe8', fg: '#5f5e5a', label: status }
}

function priorityPill(priority: string) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    routine:   { bg: '#f1efe8', fg: '#5f5e5a', label: 'routine'   },
    urgent:    { bg: '#faeeda', fg: '#854f0b', label: 'urgent'    },
    emergency: { bg: '#fcebeb', fg: '#a32d2d', label: 'emergency' },
  }
  return map[priority] ?? { bg: '#f1efe8', fg: '#5f5e5a', label: priority }
}

function dotColor(priority: string) {
  if (priority === 'emergency') return '#e24b4a'
  if (priority === 'urgent')    return '#ef9f27'
  return '#b4b2a9'
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: '13px', padding: '8px 12px',
  borderRadius: '7px', border: '1px solid #d3d1c7',
  fontFamily: 'inherit', outline: 'none', background: '#fff',
}

const btnStyle: React.CSSProperties = {
  fontSize: '13px', padding: '7px 14px', borderRadius: '7px',
  border: '1px solid #d3d1c7', background: '#fff',
  cursor: 'pointer', fontFamily: 'inherit',
}

// ── Pill ──────────────────────────────────────────────────────────────────────

function Pill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, borderRadius: '4px', padding: '2px 6px', background: bg, color: fg }}>
      {label}
    </span>
  )
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({ job, selected, onClick }: { job: Job; selected: boolean; onClick: () => void }) {
  const isDone   = job.status === 'completed' || job.status === 'closed_no_diagnosis'
  const isActive = job.status === 'in_progress'
  const sp = statusPill(job.status)
  const pp = priorityPill(job.priority)

  return (
    <div onClick={onClick} style={{
      background: '#fff',
      borderTop: selected ? '1.5px solid #378add' : '1px solid #e2e1da',
      borderRight: selected ? '1.5px solid #378add' : '1px solid #e2e1da',
      borderBottom: selected ? '1.5px solid #378add' : '1px solid #e2e1da',
      borderLeft: isActive ? '3px solid #ef9f27' : selected ? '1.5px solid #378add' : '1px solid #e2e1da',
      borderRadius: '8px', padding: '10px 12px',
      cursor: 'pointer', opacity: isDone ? 0.45 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: dotColor(job.priority) }} />
        <span style={{ fontSize: '12px', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {job.customers?.name ?? '—'}
        </span>
        {job.access_confirmation_needed && (
          <span style={{ fontSize: '9px', background: '#eeedfe', color: '#3c3489', borderRadius: '3px', padding: '1px 5px', fontWeight: 600 }}>KEY</span>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#5f5e5a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {job.locations?.name ?? '—'}{job.manual_unit ? ` · ${job.manual_unit}` : ''}
      </div>
      <div style={{ fontSize: '11px', color: '#888780', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {job.diagnoses?.repair_code ?? job.problem_description ?? 'No description'}
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
        <Pill bg={sp.bg} fg={sp.fg} label={sp.label} />
        {job.priority !== 'routine' && <Pill bg={pp.bg} fg={pp.fg} label={pp.label} />}
        {job.access_confirmation_needed && <Pill bg="#eeedfe" fg="#3c3489" label="confirm access" />}
      </div>
    </div>
  )
}

// ── Add Job Modal ─────────────────────────────────────────────────────────────

function AddJobModal({
  techs, customers, locations, onClose, addJobAction,
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

  const filteredLocations = useMemo(
    () => locations.filter(l => l.customer_id === selectedCustomerId),
    [locations, selectedCustomerId]
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: '14px', padding: '24px',
        width: '500px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Add job</div>
        <div style={{ fontSize: '12px', color: '#888780', marginBottom: '20px' }}>
          Internal entry · today's date · status set to assigned or new
        </div>

        <form onSubmit={handleSubmit}>

          {/* Customer */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Customer *</label>
            <select
              name="customer_id"
              required
              style={inputStyle}
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
            >
              <option value="">— select customer —</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Location + Unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Location *</label>
              <select
                name="location_id"
                required
                style={inputStyle}
                disabled={!selectedCustomerId}
              >
                <option value="">— select location —</option>
                {filteredLocations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <input
                name="unit"
                type="text"
                placeholder="Apt / suite / free-text"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Priority + Assign */}
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
                <option value="">— unassigned —</option>
                {techs.map(t => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Problem description */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Problem description</label>
            <textarea
              name="problem_description"
              rows={3}
              placeholder="What's the issue?"
              style={{ ...inputStyle, resize: 'none', lineHeight: '1.5' }}
            />
          </div>

          {/* Access confirmation */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            background: '#eeedfe', borderRadius: '6px', padding: '10px 12px',
            marginBottom: '20px', cursor: 'pointer', fontSize: '12px', color: '#3c3489',
          }}>
            <input
              type="checkbox"
              checked={accessNeeded}
              onChange={e => setAccessNeeded(e.target.checked)}
              style={{ marginTop: '2px', flexShrink: 0 }}
            />
            Confirm someone will be present to provide access (secured or distant site)
          </label>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fcebeb', border: '1px solid #f7c1c1',
              borderRadius: '6px', padding: '10px 12px',
              fontSize: '12px', color: '#a32d2d', marginBottom: '14px',
            }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnStyle}>Cancel</button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                ...btnStyle,
                background: isPending ? '#b4b2a9' : '#185fa5',
                color: '#fff',
                border: 'none',
                minWidth: '100px',
              }}
            >
              {isPending ? 'Creating…' : 'Create job'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: '#5f5e5a', display: 'block',
  marginBottom: '4px', fontWeight: 600,
}

// ── Main Board ────────────────────────────────────────────────────────────────

export default function PlanningBoard({ jobs, techs, techsDiagnostic, customers, locations, today, addJobAction }: Props) {
  const router = useRouter()
  const [boardJobs, setBoardJobs] = useState<Job[]>(jobs)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [showAddJob, setShowAddJob]       = useState(false)
  const [assigningId, setAssigningId]     = useState<string | null>(null)
  const [assigningTechId, setAssigningTechId] = useState('')
  const [showReassign, setShowReassign]   = useState(false)
  const [reassignTechId, setReassignTechId] = useState('')
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null)
  const [dragTargetTechId, setDragTargetTechId] = useState<string | null>(null)
  const [dragUnassignedActive, setDragUnassignedActive] = useState(false)
  const [isPending, startTransition]      = useTransition()

  // Reset reassign form when a different job is selected
  useEffect(() => {
    setShowReassign(false)
    setReassignTechId('')
  }, [selectedJobId])

  useEffect(() => {
    setBoardJobs(jobs)
  }, [jobs])

  const assignedJobs   = boardJobs.filter(j => j.assigned_tech)
  const unassignedJobs = boardJobs.filter(j => !j.assigned_tech)

  const jobsByTech: Record<string, Job[]> = {}
  for (const tech of techs) {
    jobsByTech[tech.id] = assignedJobs
      .filter(j => j.assigned_tech === tech.id)
      .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999))
  }

  const activeTechs    = techs.filter(t => jobsByTech[t.id]?.length > 0).length
  const emergencyCount = boardJobs.filter(j => j.priority === 'emergency').length
  const selectedJob    = boardJobs.find(j => j.id === selectedJobId) ?? null

  const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  function handleAssign(jobId: string, techId: string) {
    if (!techId) return
    setBoardError(null)
    const targetJobs = jobsByTech[techId] ?? []
    const nextQueuePosition = targetJobs.length > 0
      ? Math.max(...targetJobs.map(job => job.queue_position ?? 0)) + 1
      : 1
    startTransition(async () => {
      const previousJobs = boardJobs
      setBoardJobs(currentJobs => currentJobs.map(job => (
        job.id === jobId
          ? {
              ...job,
              assigned_tech: techId,
              queue_position: nextQueuePosition,
              status: job.status === 'new' ? 'assigned' : job.status,
            }
          : job
      )))
      const result = await assignJob(jobId, techId)
      if (!result.error) {
        setAssigningId(null)
        setAssigningTechId('')
        setShowReassign(false)
        setReassignTechId('')
        router.refresh()
      } else {
        setBoardJobs(previousJobs)
        setBoardError(result.error)
      }
    })
  }

  function handleToggleAccess(jobId: string, confirmed: boolean) {
    setBoardError(null)
    startTransition(async () => {
      const previousJobs = boardJobs
      setBoardJobs(currentJobs => currentJobs.map(job => (
        job.id === jobId
          ? { ...job, access_confirmed: confirmed }
          : job
      )))
      const result = await toggleAccessConfirmed(jobId, confirmed)
      if (!result.error) {
        router.refresh()
      } else {
        setBoardJobs(previousJobs)
        setBoardError(result.error)
      }
    })
  }

  function handleDragStart(jobId: string, event: React.DragEvent<HTMLDivElement>) {
    setDraggingJobId(jobId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', jobId)
  }

  function clearDragState() {
    setDraggingJobId(null)
    setDragTargetTechId(null)
    setDragUnassignedActive(false)
  }

  function handleDropToTech(techId: string, event: React.DragEvent<HTMLDivElement>) {
    const droppedJobId = event.dataTransfer.getData('text/plain') || draggingJobId
    if (!droppedJobId || isPending) return
    const draggedJob = boardJobs.find(job => job.id === droppedJobId)
    clearDragState()
    if (!draggedJob || draggedJob.assigned_tech === techId) return
    handleAssign(droppedJobId, techId)
  }

  return (
    <div>

      {/* ── Sub-topbar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e1da',
        padding: '12px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
        position: 'sticky', top: '64px', zIndex: 90,
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{dateLabel}</div>
          <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>Day view · live</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { val: activeTechs,           label: 'Techs active', red: false },
            { val: assignedJobs.length,   label: 'Jobs assigned', red: false },
            { val: unassignedJobs.length, label: 'Unassigned',    red: false },
            { val: emergencyCount,        label: 'Emergency',     red: emergencyCount > 0 },
          ].map(m => (
            <div key={m.label} style={{
              background: '#f5f4f0', borderRadius: '8px',
              padding: '6px 16px', textAlign: 'center', minWidth: '80px',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.2, color: m.red ? '#a32d2d' : '#1a1a18' }}>
                {m.val}
              </div>
              <div style={{ fontSize: '10px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '1px' }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowAddJob(true)}
          style={{ ...btnStyle, background: '#185fa5', color: '#fff', border: '1px solid #185fa5' }}
        >
          + Add job
        </button>
      </div>

      {/* ── Board ── */}
      <div style={{ padding: '20px 24px' }}>
        {boardError && (
          <div style={{
            marginBottom: '14px',
            background: '#fcebeb',
            border: '1px solid #f4b7b7',
            borderRadius: '10px',
            padding: '12px 14px',
            color: '#8e1f1f',
            fontSize: '13px',
            fontWeight: 600,
          }}>
            Planning update failed: {boardError}
          </div>
        )}

        {/* Tech columns */}
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', alignItems: 'flex-start' }}>
          {techs.length === 0 && (
            <div style={{ fontSize: '13px', color: '#888780', padding: '20px' }}>
              {techsDiagnostic ?? 'No active assignable users found.'}
            </div>
          )}

          {techs.map((tech, i) => {
            const color    = avatarColor(i)
            const techJobs = jobsByTech[tech.id] ?? []
            const doneCount = techJobs.filter(j => j.status === 'completed').length

            return (
              <div key={tech.id} style={{ flex: '0 0 230px', minWidth: '230px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700, flexShrink: 0,
                      background: color.bg, color: color.fg,
                    }}>
                      {initials(tech)}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{tech.first_name} {tech.last_name}</div>
                      <div style={{ fontSize: '11px', color: '#888780' }}>
                        {techJobs.length} job{techJobs.length !== 1 ? 's' : ''}
                        {doneCount > 0 ? ` · ${doneCount} done` : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '10px', color: '#5f5e5a', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 2px 3px', borderBottom: '1px solid #e2e1da' }}>
                  Queue
                </div>

                <div
                  onDragOver={event => {
                    event.preventDefault()
                    setDragTargetTechId(tech.id)
                  }}
                  onDragLeave={() => {
                    if (dragTargetTechId === tech.id) setDragTargetTechId(null)
                  }}
                  onDrop={event => {
                    event.preventDefault()
                    handleDropToTech(tech.id, event)
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    minHeight: '72px',
                    padding: '6px',
                    margin: '-6px',
                    borderRadius: '12px',
                    background: dragTargetTechId === tech.id ? '#eef6ff' : 'transparent',
                    outline: dragTargetTechId === tech.id ? '2px dashed #185fa5' : '2px dashed transparent',
                    outlineOffset: '-2px',
                    transition: 'background 0.12s ease, outline-color 0.12s ease',
                  }}
                >
                {techJobs.length === 0 ? (
                  <div style={{ border: '1px dashed #d3d1c7', borderRadius: '8px', padding: '12px', textAlign: 'center', fontSize: '11px', color: '#888780', background: '#faf9f5' }}>
                    no jobs assigned
                  </div>
                ) : (
                  techJobs.map(job => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={event => handleDragStart(job.id, event)}
                      onDragEnd={clearDragState}
                      style={{ opacity: draggingJobId === job.id ? 0.5 : 1 }}
                    >
                      <JobCard
                        job={job}
                        selected={selectedJobId === job.id}
                        onClick={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
                      />
                    </div>
                  ))
                )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Unassigned rail ── */}
        <div style={{ marginTop: '24px', borderTop: '1px solid #e2e1da', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Unassigned jobs</div>
            <span style={{
              fontSize: '11px', fontWeight: 700, borderRadius: '5px', padding: '3px 10px',
              background: unassignedJobs.length > 0 ? '#fcebeb' : '#eaf3de',
              color:      unassignedJobs.length > 0 ? '#a32d2d' : '#3b6d11',
            }}>
              {unassignedJobs.length === 0 ? 'All assigned' : `${unassignedJobs.length} need${unassignedJobs.length === 1 ? 's' : ''} assignment`}
            </span>
          </div>

          {unassignedJobs.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#888780' }}>All jobs are assigned for today.</div>
          ) : (
            <div
              onDragOver={event => {
                event.preventDefault()
                setDragUnassignedActive(true)
              }}
              onDragLeave={() => setDragUnassignedActive(false)}
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '8px',
                margin: '-8px',
                borderRadius: '12px',
                background: dragUnassignedActive ? '#fff7e7' : 'transparent',
                outline: dragUnassignedActive ? '2px dashed #ef9f27' : '2px dashed transparent',
                outlineOffset: '-2px',
              }}
            >
              {unassignedJobs.map(job => {
                const pp = priorityPill(job.priority)
                const isAssigning = assigningId === job.id
                return (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={event => handleDragStart(job.id, event)}
                    onDragEnd={clearDragState}
                    style={{
                      background: '#fff',
                      border: job.priority !== 'routine' ? '1px solid #fac775' : '1px solid #e2e1da',
                      borderRadius: '8px', padding: '10px 12px', minWidth: '200px', maxWidth: '240px',
                      opacity: draggingJobId === job.id ? 0.5 : 1,
                      cursor: 'grab',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor(job.priority) }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.customers?.name ?? '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#5f5e5a', marginBottom: '2px' }}>
                      {job.locations?.name ?? '—'}{job.manual_unit ? ` · ${job.manual_unit}` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888780', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.problem_description ?? 'No description'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Pill bg={pp.bg} fg={pp.fg} label={pp.label} />
                    </div>
                    {isAssigning ? (
                      <div>
                        <select
                          style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px', marginBottom: '6px' }}
                          value={assigningTechId}
                          onChange={e => setAssigningTechId(e.target.value)}
                        >
                          <option value="">— pick a tech —</option>
                          {techs.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name[0]}.</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => { setAssigningId(null); setAssigningTechId('') }}
                            style={{ ...btnStyle, flex: 1, fontSize: '11px', padding: '5px 8px' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAssign(job.id, assigningTechId)}
                            disabled={!assigningTechId || isPending}
                            style={{
                              ...btnStyle, flex: 1, fontSize: '11px', padding: '5px 8px',
                              background: (!assigningTechId || isPending) ? '#b4b2a9' : '#185fa5',
                              color: '#fff', border: 'none',
                              cursor: (!assigningTechId || isPending) ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isPending ? '…' : 'Assign'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAssigningId(job.id); setAssigningTechId('') }}
                        style={{ ...btnStyle, fontSize: '11px', padding: '5px 10px', width: '100%', color: '#185fa5' }}
                      >
                        Assign to tech
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selectedJob && (
          <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '12px', padding: '16px 20px', marginTop: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              {selectedJob.customers?.name ?? '—'} — {selectedJob.locations?.name ?? '—'}
              {selectedJob.manual_unit ? ` · ${selectedJob.manual_unit}` : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              {[
                { label: 'Status',    value: statusPill(selectedJob.status).label },
                { label: 'Priority',  value: selectedJob.priority },
                { label: 'Diagnosis', value: selectedJob.diagnoses?.repair_code ?? '—' },
                { label: 'Problem',   value: selectedJob.problem_description ?? '—' },
                { label: 'Access',    value: selectedJob.access_confirmation_needed ? (selectedJob.access_confirmed ? 'Confirmed ✓' : '⚠️ Not confirmed') : 'Not required' },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{row.label}</div>
                  <div style={{ fontSize: '13px' }}>{row.value}</div>
                </div>
              ))}
            </div>

            {/* Inline reassign form */}
            {showReassign && (
              <div style={{ borderTop: '1px solid #e2e1da', paddingTop: '12px', marginTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#5f5e5a', marginBottom: '8px' }}>Reassign to</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={reassignTechId}
                    onChange={e => setReassignTechId(e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontSize: '12px' }}
                  >
                    <option value="">— select tech —</option>
                    {techs.map(t => (
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign(selectedJob.id, reassignTechId)}
                    disabled={!reassignTechId || isPending}
                    style={{
                      ...btnStyle,
                      background: (!reassignTechId || isPending) ? '#b4b2a9' : '#185fa5',
                      color: '#fff', border: 'none',
                      cursor: (!reassignTechId || isPending) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isPending ? '…' : 'Save'}
                  </button>
                  <button onClick={() => { setShowReassign(false); setReassignTechId('') }} style={btnStyle}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e1da' }}>
              <a
                href={`/jobs/${selectedJob.id}`}
                style={{
                  ...btnStyle,
                  textDecoration: 'none',
                  display: 'inline-block',
                  background: '#173d61',
                  border: '1px solid #173d61',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                Open Job
              </a>
              <button
                onClick={() => { setShowReassign(!showReassign); setReassignTechId('') }}
                style={{
                  ...btnStyle,
                  background: showReassign ? '#f5f4f0' : '#fff',
                  fontWeight: showReassign ? 600 : 400,
                }}
              >
                Reassign
              </button>
              <button style={btnStyle}>Add second tech</button>
              {selectedJob.access_confirmation_needed && (
                <button
                  onClick={() => handleToggleAccess(selectedJob.id, !selectedJob.access_confirmed)}
                  disabled={isPending}
                  style={{
                    ...btnStyle,
                    background: selectedJob.access_confirmed ? '#eaf3de' : '#eeedfe',
                    color: selectedJob.access_confirmed ? '#3b6d11' : '#3c3489',
                    border: selectedJob.access_confirmed ? '1px solid #b8dcb8' : '1px solid #cecbf6',
                  }}
                >
                  {selectedJob.access_confirmed ? '✓ Access confirmed' : 'Confirm access'}
                </button>
              )}
              <button onClick={() => setSelectedJobId(null)} style={{ ...btnStyle, marginLeft: 'auto', color: '#888780' }}>Dismiss</button>
            </div>
          </div>
        )}

      </div>

      {/* ── Add Job modal ── */}
      {showAddJob && (
        <AddJobModal
          techs={techs}
          customers={customers}
          locations={locations}
          onClose={() => setShowAddJob(false)}
          addJobAction={addJobAction}
        />
      )}

    </div>
  )
}
