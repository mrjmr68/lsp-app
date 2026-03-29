'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Location {
  id: string
  name: string
  street_address: string | null
  city: string | null
  state: string | null
  units: { id: string; systems?: { id: string }[] }[]
}

interface Customer {
  id: string
  name: string
  type: string | null
  billing_address: string | null
  billing_email: string | null
  billing_phone: string | null
  bill_to_parent: boolean
  notes: string | null
  parent_id: string | null
  locations: Location[]
}

interface Props {
  customer: Customer
  parentName: string | null
  parentId: string | null
  allCustomers: { id: string; name: string }[]
  updateCustomerAction: (customerId: string, fields: Record<string, unknown>) => Promise<{ error?: string; success?: boolean }>
  createLocationAction: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px', color: '#888780', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '2px',
}

const ACTIVE_INPUT: React.CSSProperties = {
  fontSize: '13px', color: '#1a1a18', border: 'none',
  borderBottom: '2px solid #185fa5', outline: 'none',
  background: 'transparent', width: '100%', padding: '1px 0',
  fontFamily: 'inherit',
}

const FIELD_WRAP: React.CSSProperties = { marginBottom: '10px' }

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: '13px', padding: '8px 12px',
  borderRadius: '7px', border: '1px solid #d3d1c7',
  fontFamily: 'inherit', outline: 'none', background: '#fff',
  boxSizing: 'border-box',
}

const modalLabelStyle: React.CSSProperties = {
  fontSize: '12px', color: '#5f5e5a', display: 'block',
  marginBottom: '4px', fontWeight: 600,
}

function AddLocationModal({
  customerId,
  onClose,
  action,
}: {
  customerId: string
  onClose: () => void
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('customer_id', customerId)

    startTransition(async () => {
      const result = await action(formData)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '500px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a18', marginBottom: '16px' }}>Add Location</div>

        {error && (
          <div style={{ background: '#fce8e8', border: '1px solid #f7c1c1', borderRadius: '7px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#a32d2d' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={modalLabelStyle}>Name *</label>
              <input name="name" required style={inputStyle} />
            </div>
            <div>
              <label style={modalLabelStyle}>Street address</label>
              <input name="street_address" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: '8px' }}>
              <div>
                <label style={modalLabelStyle}>City</label>
                <input name="city" style={inputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>State</label>
                <input name="state" maxLength={2} style={inputStyle} />
              </div>
              <div>
                <label style={modalLabelStyle}>ZIP</label>
                <input name="zip" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={modalLabelStyle}>Access notes</label>
              <textarea name="access_notes" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={modalLabelStyle}>Tax rate</label>
              <input name="tax_rate" type="number" step="0.0001" min="0" max="0.15" placeholder="e.g. 0.0475 for 4.75%" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #d3d1c7', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={isPending} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: 'none', background: '#185fa5', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? 'Creating…' : 'Create location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CustomerDetail({ customer, parentName, parentId, allCustomers, updateCustomerAction, createLocationAction }: Props) {
  const router = useRouter()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [showAddLocation, setShowAddLocation] = useState(false)

  const [custData, setCustData] = useState({
    name: customer.name,
    type: customer.type,
    parent_id: customer.parent_id,
    billing_address: customer.billing_address,
    billing_email: customer.billing_email,
    billing_phone: customer.billing_phone,
    bill_to_parent: customer.bill_to_parent ?? false,
    notes: customer.notes,
  })

  async function saveField(key: string, value: unknown) {
    setCustData(prev => ({ ...prev, [key]: value }))
    setEditingField(null)
    setSavingField(key)
    await updateCustomerAction(customer.id, { [key]: value })
    setSavingField(null)
  }

  function editableText(key: keyof typeof custData, label: string) {
    const val = custData[key] as string | null
    const isEditing = editingField === key
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>{label}</div>
        {isEditing ? (
          <input
            autoFocus
            defaultValue={val ?? ''}
            onBlur={e => saveField(key, e.target.value.trim() || null)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            style={ACTIVE_INPUT}
          />
        ) : (
          <div
            onClick={() => setEditingField(key)}
            style={{ fontSize: '13px', color: val ? '#1a1a18' : '#b4b2a9', cursor: 'text' }}
          >
            {val || '— tap to add'}
            {savingField === key && <span style={{ fontSize: '10px', color: '#888780', marginLeft: '6px' }}>saving…</span>}
          </div>
        )}
      </div>
    )
  }

  function editableSelect(key: keyof typeof custData, label: string, options: { value: string; label: string }[]) {
    const val = custData[key] as string | null
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>{label}</div>
        <select
          value={val ?? ''}
          onChange={e => saveField(key, e.target.value || null)}
          style={{ fontSize: '13px', color: '#1a1a18', border: 'none', borderBottom: '1px solid #e2e1da', background: 'transparent', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', padding: '1px 0', width: '100%' }}
        >
          <option value="">— none —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {savingField === key && <span style={{ fontSize: '10px', color: '#888780' }}>saving…</span>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px' }}>

      {/* Breadcrumb */}
      <div style={{ fontSize: '12px', color: '#888780', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span onClick={() => router.push('/customers')} style={{ cursor: 'pointer', color: '#185fa5' }}>Customers</span>
        <span>›</span>
        <span style={{ color: '#1a1a18' }}>{custData.name}</span>
      </div>

      {/* Customer info card — inline editable */}
      <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: '#b4b2a9', marginBottom: '8px' }}>Tap any field to edit</div>

        {editableText('name', 'Name')}

        {editableSelect('type', 'Type', [
          { value: 'residential', label: 'Residential' },
          { value: 'commercial', label: 'Commercial' },
          { value: 'property_management', label: 'Property Management' },
          { value: 'facilities_provider', label: 'Facilities Provider' },
        ])}

        {/* Parent account */}
        <div style={FIELD_WRAP}>
          <div style={LABEL_STYLE}>Parent account</div>
          <select
            value={custData.parent_id ?? ''}
            onChange={e => {
              const newParent = e.target.value || null
              saveField('parent_id', newParent)
              if (!newParent && custData.bill_to_parent) {
                saveField('bill_to_parent', false)
              }
            }}
            style={{ fontSize: '13px', color: '#1a1a18', border: 'none', borderBottom: '1px solid #e2e1da', background: 'transparent', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', padding: '1px 0', width: '100%' }}
          >
            <option value="">— none —</option>
            {allCustomers.filter(c => c.id !== customer.id).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {savingField === 'parent_id' && <span style={{ fontSize: '10px', color: '#888780' }}>saving…</span>}
        </div>

        {/* Bill to parent */}
        {custData.parent_id && (
          <div style={{ ...FIELD_WRAP, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={custData.bill_to_parent}
              onChange={e => saveField('bill_to_parent', e.target.checked)}
              id="bill_to_parent_edit"
            />
            <label htmlFor="bill_to_parent_edit" style={{ fontSize: '13px', color: '#1a1a18', cursor: 'pointer' }}>
              Bill to parent account
            </label>
            {savingField === 'bill_to_parent' && <span style={{ fontSize: '10px', color: '#888780' }}>saving…</span>}
          </div>
        )}

        {editableText('billing_address', 'Billing address')}
        {editableText('billing_email', 'Billing email')}
        {editableText('billing_phone', 'Billing phone')}
        {editableText('notes', 'Notes')}
      </div>

      {/* Locations header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Locations ({customer.locations.length})
        </div>
        <button
          onClick={() => setShowAddLocation(true)}
          style={{ background: '#185fa5', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Add
        </button>
      </div>

      {customer.locations.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888780' }}>No locations on record.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {customer.locations.map(loc => {
          const flat = custData.type === 'commercial' || custData.type === 'facilities_provider'
          const count = flat
            ? (loc.units ?? []).reduce((sum, u) => sum + (u.systems?.length ?? 0), 0)
            : (loc.units?.length ?? 0)
          const countLabel = flat
            ? (count === 1 ? 'system' : 'systems')
            : (count === 1 ? 'unit' : 'units')
          const addressLine = [loc.street_address, loc.city, loc.state].filter(Boolean).join(', ')
          return (
            <div
              key={loc.id}
              onClick={() => router.push(`/customers/${customer.id}/${loc.id}`)}
              style={{
                background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px',
                padding: '12px 14px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '10px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a18', marginBottom: '1px' }}>{loc.name}</div>
                {addressLine && <div style={{ fontSize: '11px', color: '#888780' }}>{addressLine}</div>}
              </div>
              <div style={{ fontSize: '12px', color: '#888780', flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontWeight: 600, color: '#5f5e5a' }}>{count}</div>
                <div style={{ fontSize: '10px' }}>{countLabel}</div>
              </div>
              <div style={{ color: '#b4b2a9', fontSize: '14px', flexShrink: 0 }}>›</div>
            </div>
          )
        })}
      </div>

      {showAddLocation && (
        <AddLocationModal
          customerId={customer.id}
          onClose={() => setShowAddLocation(false)}
          action={createLocationAction}
        />
      )}
    </div>
  )
}
