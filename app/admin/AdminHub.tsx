'use client'

import { useState, useTransition } from 'react'
import CatalogAdmin from '@/app/catalog/CatalogAdmin'
import { updateUserProfileAction } from './actions'

type AdminUser = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  role: 'tech' | 'dispatcher' | 'admin' | 'owner'
  active: boolean
}

interface Props {
  counts: {
    items: number
    diagnoses: number
    bundles: number
    bundleLines: number
  }
  users: AdminUser[]
  appConfig: {
    labor_cost_per_hour: number
    travel_time_hours: number
    refrigerant_cost_per_lb: number
    profit_per_hour_target: number
  } | null
  catalogTemplates: Array<{
    id: string
    location: string
    component: string
    action: string
    repair_code: string
    invoice_description: string | null
    repair_notes: string | null
    variable_pricing: boolean
    one_shot: boolean
    active: boolean
    repair_bundles: {
      id: string
      flat_rate: number | null
      travel_time_hours: number | null
      work_time_hours: number | null
      total_time_hours: number | null
      labor_cost: number | null
      part_material_cost: number | null
      profit_amount: number | null
      profit_per_hour: number | null
      margin_percent: number | null
      refrigerant_lbs: number | null
      refrigerant_cost: number | null
      materials_label: string | null
      material_cost: number | null
      pricing_notes: string | null
    } | null
  }>
  canManageCatalog: boolean
  canManageUsers: boolean
}

const ROLE_OPTIONS = [
  { value: 'tech', label: 'Tech' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
] as const

export default function AdminHub({
  counts,
  users,
  appConfig,
  catalogTemplates,
  canManageCatalog,
  canManageUsers,
}: Props) {
  const [tab, setTab] = useState<'users' | 'catalog'>('users')

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 16px 48px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#1a1a18', marginBottom: '6px' }}>
          Admin
        </div>
        <div style={{ fontSize: '14px', color: '#5f5e5a', lineHeight: 1.6, maxWidth: '720px' }}>
          Manage internal configuration for the team, including user access and the repair catalog used for bundles and invoicing.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} label="Users" />
        <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')} label="Catalog" />
      </div>

      {tab === 'users' ? (
        <UsersPanel users={users} canManageUsers={canManageUsers} />
      ) : (
        <CatalogAdmin
          counts={counts}
          appConfig={appConfig}
          templates={catalogTemplates}
          canManageCatalog={canManageCatalog}
          compact
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 15px',
        borderRadius: '999px',
        border: active ? '1px solid rgba(234, 211, 159, 0.9)' : '1px solid #d3d1c7',
        background: active ? '#ead39f' : '#fff',
        color: active ? '#1b1e23' : '#5f5e5a',
        fontSize: '13px',
        fontWeight: active ? 700 : 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function UsersPanel({ users, canManageUsers }: { users: AdminUser[]; canManageUsers: boolean }) {
  return (
    <div>
      <div style={{
        background: '#fff',
        border: '1px solid #e2e1da',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          User Management
        </div>
        <div style={{ fontSize: '14px', color: '#5f5e5a', lineHeight: 1.6 }}>
          Edit team members, update roles, and disable users without deleting their history.
        </div>
      </div>

      {!canManageUsers && (
        <div style={{
          background: '#fcebeb',
          border: '1px solid #f7c1c1',
          color: '#a32d2d',
          borderRadius: '10px',
          padding: '12px 14px',
          fontSize: '13px',
          marginBottom: '14px',
        }}>
          User editing is limited to admin and owner accounts.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {users.map(user => (
          <UserRow key={user.id} user={user} canManageUsers={canManageUsers} />
        ))}
      </div>
    </div>
  )
}

function UserRow({ user, canManageUsers }: { user: AdminUser; canManageUsers: boolean }) {
  const [draft, setDraft] = useState({
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone ?? '',
    role: user.role,
    active: user.active,
  })
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft(current => ({ ...current, [key]: value }))
    setMessage(null)
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateUserProfileAction({
        userId: user.id,
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone,
        role: draft.role,
        active: draft.active,
      })
      setMessage(result.success ? 'Saved' : (result.error ?? 'Save failed'))
    })
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e1da',
      borderRadius: '14px',
      padding: '16px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'end' }}>
        <Field label="First name">
          <input value={draft.firstName} onChange={event => update('firstName', event.target.value)} style={inputStyle} disabled={!canManageUsers || isPending} />
        </Field>
        <Field label="Last name">
          <input value={draft.lastName} onChange={event => update('lastName', event.target.value)} style={inputStyle} disabled={!canManageUsers || isPending} />
        </Field>
        <Field label="Phone">
          <input value={draft.phone} onChange={event => update('phone', event.target.value)} style={inputStyle} disabled={!canManageUsers || isPending} />
        </Field>
        <Field label="Role">
          <select value={draft.role} onChange={event => update('role', event.target.value as AdminUser['role'])} style={inputStyle} disabled={!canManageUsers || isPending}>
            {ROLE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 4px', color: '#1a1a18', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={event => update('active', event.target.checked)}
              disabled={!canManageUsers || isPending}
            />
            Active
          </label>
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12px', color: message === 'Saved' ? '#3b6d11' : '#888780' }}>
          {message ?? user.id}
        </div>
        <button
          onClick={handleSave}
          disabled={!canManageUsers || isPending}
          style={{
            fontSize: '12px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #185fa5',
            background: !canManageUsers || isPending ? '#b4b2a9' : '#185fa5',
            color: '#fff',
            cursor: !canManageUsers || isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            fontWeight: 600,
          }}
        >
          {isPending ? 'Saving...' : 'Save user'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '13px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #d3d1c7',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
}
