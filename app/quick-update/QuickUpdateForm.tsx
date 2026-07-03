'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type QuickUpdateVisit = {
  id: string
  label: string
  detail: string
  status: string
  priority: string
  assignedTechName: string
}

type QuickUpdateResult = {
  error?: string
  success?: boolean
}

type Props = {
  visits: QuickUpdateVisit[]
  quickUpdateAction: (formData: FormData) => Promise<QuickUpdateResult>
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 16,
  padding: '12px 12px',
  borderRadius: 8,
  border: '1px solid #d2cbbd',
  background: '#fffdf8',
  color: '#202329',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#4f4a43',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

export default function QuickUpdateForm({ visits, quickUpdateAction }: Props) {
  const router = useRouter()
  const [selectedVisitId, setSelectedVisitId] = useState(visits[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selectedVisit = useMemo(
    () => visits.find(visit => visit.id === selectedVisitId) ?? null,
    [selectedVisitId, visits],
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await quickUpdateAction(formData)
      if (result.error) {
        setError(result.error)
        return
      }

      form.reset()
      setSelectedVisitId(selectedVisitId)
      setSuccess(true)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <div>
        <label htmlFor="service_visit_id" style={labelStyle}>Visit</label>
        <select
          id="service_visit_id"
          name="service_visit_id"
          required
          value={selectedVisitId}
          onChange={event => setSelectedVisitId(event.target.value)}
          style={inputStyle}
        >
          {visits.length === 0 ? (
            <option value="">No active visits available</option>
          ) : (
            visits.map(visit => (
              <option key={visit.id} value={visit.id}>{visit.label}</option>
            ))
          )}
        </select>
        {selectedVisit && (
          <p style={{ margin: '7px 0 0', color: '#615c53', fontSize: 13, lineHeight: 1.4 }}>
            {selectedVisit.detail} · {selectedVisit.assignedTechName} · {selectedVisit.status.replaceAll('_', ' ')}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label htmlFor="note_type" style={labelStyle}>Update type</label>
          <select id="note_type" name="note_type" defaultValue="general" style={inputStyle}>
            <option value="general">General note</option>
            <option value="access">Access</option>
            <option value="approval">Approval</option>
            <option value="timing">Timing</option>
            <option value="status">Status</option>
          </select>
        </div>

        <div>
          <label htmlFor="status_update" style={labelStyle}>Status</label>
          <select id="status_update" name="status_update" defaultValue="" style={inputStyle}>
            <option value="">No change</option>
            <option value="scheduled">Scheduled</option>
            <option value="en_route">En route</option>
            <option value="on_site">On site</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="body" style={labelStyle}>Note</label>
        <textarea
          id="body"
          name="body"
          rows={4}
          placeholder="Gate code received, resident available after 2, approval given, running late..."
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }}
        />
      </div>

      <div>
        <label htmlFor="access_notes" style={labelStyle}>Access detail</label>
        <input
          id="access_notes"
          name="access_notes"
          type="text"
          placeholder="Optional access detail to store on the request"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="access_confirmed" style={labelStyle}>Access confirmation</label>
        <select id="access_confirmed" name="access_confirmed" defaultValue="" style={inputStyle}>
          <option value="">No change</option>
          <option value="confirmed">Access confirmed</option>
          <option value="not_confirmed">Access not confirmed</option>
        </select>
      </div>

      {error && (
        <div style={{
          background: '#fff0ec',
          border: '1px solid #e0b8ae',
          color: '#7a3125',
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
          fontWeight: 700,
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: '#edf7ed',
          border: '1px solid #bad9ba',
          color: '#285a2c',
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
          fontWeight: 800,
        }}>
          Update saved.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 4 }}>
        <button
          type="button"
          onClick={() => router.push('/today')}
          style={{
            minHeight: 44,
            padding: '0 14px',
            borderRadius: 8,
            border: '1px solid #d2cbbd',
            background: '#fffdf8',
            color: '#343332',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          Today
        </button>
        <button
          type="submit"
          disabled={isPending || visits.length === 0}
          style={{
            minHeight: 44,
            padding: '0 16px',
            borderRadius: 8,
            border: '1px solid #111318',
            background: isPending || visits.length === 0 ? '#6b6c6f' : '#202329',
            color: '#fff8df',
            fontWeight: 900,
            cursor: isPending || visits.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Saving...' : 'Save update'}
        </button>
      </div>
    </form>
  )
}
