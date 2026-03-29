'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface CustomerRow {
  id: string
  name: string
  type: string | null
  parent_id: string | null
  locations: { id: string }[]
}

interface Props {
  customers: CustomerRow[]
  createCustomerAction: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
}

const TYPE_STYLE: Record<string, React.CSSProperties> = {
  residential:          { background: '#e6f1fb', color: '#185fa5' },
  commercial:           { background: '#fff3e0', color: '#8a4c00' },
  property_management:  { background: '#f3e8ff', color: '#6b21a8' },
  facilities_provider:  { background: '#eaf3de', color: '#3b6d11' },
}

const TYPE_LABEL: Record<string, string> = {
  residential:          'Residential',
  commercial:           'Commercial',
  property_management:  'Prop. Mgmt',
  facilities_provider:  'Facilities',
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: '13px', padding: '8px 12px',
  borderRadius: '7px', border: '1px solid #d3d1c7',
  fontFamily: 'inherit', outline: 'none', background: '#fff',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: '#5f5e5a', display: 'block',
  marginBottom: '4px', fontWeight: 600,
}

function AddCustomerModal({
  customers,
  onClose,
  action,
}: {
  customers: CustomerRow[]
  onClose: () => void
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
}) {
  const [selectedParentId, setSelectedParentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('bill_to_parent', selectedParentId && form.bill_to_parent?.checked ? 'true' : 'false')

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
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a18', marginBottom: '16px' }}>Add Customer</div>

        {error && (
          <div style={{ background: '#fce8e8', border: '1px solid #f7c1c1', borderRadius: '7px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#a32d2d' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input name="name" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select name="type" style={inputStyle}>
                <option value="">— select —</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="property_management">Property Management</option>
                <option value="facilities_provider">Facilities Provider</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Parent account</label>
              <select name="parent_id" value={selectedParentId} onChange={e => setSelectedParentId(e.target.value)} style={inputStyle}>
                <option value="">— none —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {selectedParentId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" name="bill_to_parent" id="bill_to_parent" />
                <label htmlFor="bill_to_parent" style={{ fontSize: '13px', color: '#1a1a18', cursor: 'pointer' }}>Bill to parent account</label>
              </div>
            )}
            <div>
              <label style={labelStyle}>Billing address</label>
              <input name="billing_address" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Billing email</label>
              <input name="billing_email" type="email" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Billing phone</label>
              <input name="billing_phone" type="tel" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea name="notes" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #d3d1c7', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={isPending} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: 'none', background: '#185fa5', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? 'Creating…' : 'Create customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CustomersList({ customers, createCustomerAction }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const customerMap = useMemo(() => {
    const m = new Map<string, string>()
    customers.forEach(c => m.set(c.id, c.name))
    return m
  }, [customers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c => c.name.toLowerCase().includes(q))
  }, [customers, search])

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a18', margin: 0 }}>
            Customers
          </h1>
          <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>
            {customers.length} total
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ background: '#185fa5', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Add
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '9px 12px', marginBottom: '12px',
          border: '1px solid #e2e1da', borderRadius: '8px',
          fontSize: '13px', color: '#1a1a18', background: '#fff',
          outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />

      {/* List */}
      {filtered.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888780', textAlign: 'center', padding: '32px 0' }}>
          No customers match &quot;{search}&quot;
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(c => {
          const parentName = c.parent_id ? customerMap.get(c.parent_id) : null
          const locCount = c.locations?.length ?? 0
          const typeStyle = c.type ? TYPE_STYLE[c.type] : null

          return (
            <div
              key={c.id}
              onClick={() => router.push(`/customers/${c.id}`)}
              style={{
                background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px',
                padding: '12px 14px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '10px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a18', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {c.name}
                  {c.type && typeStyle && (
                    <span style={{ fontSize: '10px', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, ...typeStyle }}>
                      {TYPE_LABEL[c.type] ?? c.type}
                    </span>
                  )}
                </div>
                {parentName && (
                  <div style={{ fontSize: '11px', color: '#888780' }}>Under: {parentName}</div>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#888780', flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontWeight: 600, color: '#5f5e5a' }}>{locCount}</div>
                <div style={{ fontSize: '10px' }}>{locCount === 1 ? 'location' : 'locations'}</div>
              </div>
              <div style={{ color: '#b4b2a9', fontSize: '14px', flexShrink: 0 }}>›</div>
            </div>
          )
        })}
      </div>

      {showAddModal && (
        <AddCustomerModal
          customers={customers}
          onClose={() => setShowAddModal(false)}
          action={createCustomerAction}
        />
      )}
    </div>
  )
}
