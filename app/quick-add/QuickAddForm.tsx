'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type QuickAddCustomer = {
  id: string
  name: string
  type: string | null
}

export type QuickAddLocation = {
  id: string
  name: string
  customer_id: string
}

export type QuickAddTech = {
  id: string
  first_name: string
  last_name: string
  role: string
}

type QuickAddResult = {
  error?: string
  success?: boolean
  jobId?: string
  serviceRequestId?: string
  serviceVisitId?: string
}

type Props = {
  customers: QuickAddCustomer[]
  locations: QuickAddLocation[]
  techs: QuickAddTech[]
  addJobAction: (formData: FormData) => Promise<QuickAddResult>
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

function techName(tech: QuickAddTech) {
  return `${tech.first_name} ${tech.last_name}`.trim()
}

export default function QuickAddForm({ customers, locations, techs, addJobAction }: Props) {
  const router = useRouter()
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredLocations = useMemo(
    () => locations.filter(location => location.customer_id === selectedCustomerId),
    [locations, selectedCustomerId],
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const form = event.currentTarget
    const formData = new FormData(form)
    const accessNotes = formData.get('access_notes')?.toString().trim()

    formData.set('workflow_type', 'standard')
    formData.set('source', 'dispatcher')
    formData.set('access_confirmation_needed', accessNotes ? 'true' : 'false')

    startTransition(async () => {
      const result = await addJobAction(formData)
      if (result.error) {
        setError(result.error)
        return
      }

      form.reset()
      setSelectedCustomerId('')
      router.push('/today')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <input type="hidden" name="workflow_type" value="standard" />
      <input type="hidden" name="source" value="dispatcher" />

      <div>
        <label htmlFor="customer_id" style={labelStyle}>Customer</label>
        <select
          id="customer_id"
          name="customer_id"
          required
          value={selectedCustomerId}
          onChange={event => setSelectedCustomerId(event.target.value)}
          style={inputStyle}
        >
          <option value="">Select customer</option>
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(110px, 0.6fr)', gap: 10 }}>
        <div>
          <label htmlFor="location_id" style={labelStyle}>Property</label>
          <select
            id="location_id"
            name="location_id"
            required
            disabled={!selectedCustomerId}
            style={inputStyle}
          >
            <option value="">Select property</option>
            {filteredLocations.map(location => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="unit" style={labelStyle}>Unit</label>
          <input
            id="unit"
            name="unit"
            type="text"
            placeholder="1212"
            autoComplete="off"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label htmlFor="problem_description" style={labelStyle}>Reported issue</label>
        <textarea
          id="problem_description"
          name="problem_description"
          required
          rows={4}
          placeholder="Unit not cooling, leak at air handler, no heat..."
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label htmlFor="priority" style={labelStyle}>Priority</label>
          <select id="priority" name="priority" defaultValue="routine" style={inputStyle}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        <div>
          <label htmlFor="assigned_tech" style={labelStyle}>Assign</label>
          <select id="assigned_tech" name="assigned_tech" defaultValue="" style={inputStyle}>
            <option value="">Unassigned</option>
            {techs.map(tech => (
              <option key={tech.id} value={tech.id}>{techName(tech)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="access_notes" style={labelStyle}>Access note</label>
        <input
          id="access_notes"
          name="access_notes"
          type="text"
          placeholder="Gate code, resident availability, lockbox, call first..."
          style={inputStyle}
        />
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

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 4 }}>
        <button
          type="button"
          onClick={() => router.push('/')}
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
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            minHeight: 44,
            padding: '0 16px',
            borderRadius: 8,
            border: '1px solid #111318',
            background: isPending ? '#6b6c6f' : '#202329',
            color: '#fff8df',
            fontWeight: 900,
            cursor: isPending ? 'wait' : 'pointer',
          }}
        >
          {isPending ? 'Creating...' : 'Create job'}
        </button>
      </div>
    </form>
  )
}
