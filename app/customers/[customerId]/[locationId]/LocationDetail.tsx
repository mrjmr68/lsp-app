'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MAKE_OPTIONS,
  METERING_OPTIONS,
  REFRIGERANT_OPTIONS,
  SYSTEM_SUBTYPE_OPTIONS,
  SYSTEM_TYPE_OPTIONS,
  formatStoredDate,
} from '@/utils/hvac/systems'

interface SystemRecord {
  id: string
  name: string
  system_type: string | null
  system_subtype: string | null
  group_name: string | null
  tonnage: number | null
  make: string | null
  model: string | null
  serial_number: string | null
  refrigerant_type: string | null
  metering_device: string | null
  notes: string | null
  served_areas: string | null
  thermostat_location: string | null
  equipment_location: string | null
  controls_notes: string | null
  manufacture_date: string | null
  manufacture_date_source: string | null
  _unitId: string
}

interface Unit {
  id: string
  name: string
  unit_type: string | null
  systems: { id: string }[]
}

interface Location {
  id: string
  name: string
  street_address: string | null
  city: string | null
  state: string | null
  zip: string | null
  access_notes: string | null
  tax_rate: number | null
  customer_id: string
  customers: { id: string; name: string; type: string | null } | null
  units: Unit[]
}

interface Props {
  location: Location
  customerId: string
  customerType: string | null
  flatSystems?: SystemRecord[]
  updateLocationAction: (locationId: string, customerId: string, fields: Record<string, unknown>) => Promise<{ error?: string; success?: boolean }>
  createSystemForLocationAction: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
  createUnitWithSystemAction: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
  updateSystemAction: (systemId: string, customerId: string, locationId: string, unitId: string, fields: Record<string, unknown>) => Promise<{ error?: string; success?: boolean }>
}

const UNIT_TYPE_LABEL: Record<string, string> = {
  apartment: 'Apartment',
  suite: 'Suite',
  floor: 'Floor',
  main: 'Main',
}

const SYSTEM_TYPE_LABEL: Record<string, string> = {
  rtu: 'RTU',
  heat_pump: 'Heat Pump',
  ptac: 'PTAC',
  air_handler: 'Air Handler',
  condensing_unit: 'Condensing Unit',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  color: '#888780',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '2px',
}

const ACTIVE_INPUT: React.CSSProperties = {
  fontSize: '13px',
  color: '#1a1a18',
  border: 'none',
  borderBottom: '2px solid #185fa5',
  outline: 'none',
  background: 'transparent',
  width: '100%',
  padding: '1px 0',
  fontFamily: 'inherit',
}

const FIELD_WRAP: React.CSSProperties = { marginBottom: '10px' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '13px',
  padding: '8px 12px',
  borderRadius: '7px',
  border: '1px solid #d3d1c7',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
}

const modalLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#5f5e5a',
  display: 'block',
  marginBottom: '4px',
  fontWeight: 600,
}

function SaveHint({ active }: { active: boolean }) {
  if (!active) return null
  return <span style={{ fontSize: '10px', color: '#888780', marginLeft: '6px' }}>saving...</span>
}

function SharedSiteFields({ prefix = '' }: { prefix?: string }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Areas served</label>
          <input name={`${prefix}served_areas`} placeholder="Lobby, offices, apartment bedrooms..." style={inputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Thermostat location</label>
          <input name={`${prefix}thermostat_location`} placeholder="Hallway, suite reception..." style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Equipment location</label>
          <input name={`${prefix}equipment_location`} placeholder="Roof, above ceiling, closet..." style={inputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Controls notes</label>
          <input name={`${prefix}controls_notes`} placeholder="Zone controller, BAS, disconnect..." style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={modalLabelStyle}>General notes</label>
        <textarea name={`${prefix}notes`} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    </>
  )
}

function SingleSystemFields({
  prefix = '',
  requireName,
  autoNamedLabel,
}: {
  prefix?: string
  requireName: boolean
  autoNamedLabel?: string
}) {
  return (
    <>
      {requireName ? (
        <div>
          <label style={modalLabelStyle}>Equipment label *</label>
          <input name={`${prefix}name`} required placeholder='e.g. "RTU-1" or "Main PTAC"' style={inputStyle} />
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#888780' }}>
          {autoNamedLabel ?? 'System names will be generated automatically.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Make</label>
          <select name={`${prefix}make`} style={inputStyle} defaultValue="">
            <option value="">- select -</option>
            {MAKE_OPTIONS.map(make => <option key={make} value={make}>{make}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Model</label>
          <input name={`${prefix}model`} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Serial number</label>
          <input name={`${prefix}serial_number`} style={inputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Tonnage</label>
          <input name={`${prefix}tonnage`} type="number" step="0.5" min="0" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Refrigerant</label>
          <select name={`${prefix}refrigerant_type`} style={inputStyle} defaultValue="">
            <option value="">- select -</option>
            {REFRIGERANT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Metering device</label>
          <select name={`${prefix}metering_device`} style={inputStyle} defaultValue="">
            <option value="">- select -</option>
            {METERING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>
    </>
  )
}

function HeatPumpFields({ prefix = '' }: { prefix?: string }) {
  return (
    <>
      <div>
        <label style={modalLabelStyle}>Heat pump label</label>
        <input name={`${prefix}group_name`} placeholder='e.g. "Heat Pump A"' style={inputStyle} />
      </div>

      <div style={{ borderTop: '1px solid #e2e1da', paddingTop: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a18', marginBottom: '8px' }}>Condensing Unit</div>
        <SingleSystemFields prefix={`${prefix}outdoor_`} requireName={false} autoNamedLabel="The condensing unit name will be generated from the heat pump label." />
      </div>

      <div style={{ borderTop: '1px solid #e2e1da', paddingTop: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a18', marginBottom: '8px' }}>Air Handler</div>
        <SingleSystemFields prefix={`${prefix}indoor_`} requireName={false} autoNamedLabel="The air handler name will be generated from the heat pump label." />
      </div>
    </>
  )
}

function AdaptiveSystemFields({
  systemType,
  prefix = '',
  requireCommercialName,
}: {
  systemType: string
  prefix?: string
  requireCommercialName: boolean
}) {
  if (!systemType) return null

  if (systemType === 'heat_pump') {
    return (
      <>
        <HeatPumpFields prefix={prefix} />
        <SharedSiteFields prefix={prefix} />
      </>
    )
  }

  return (
    <>
      <SingleSystemFields prefix={prefix} requireName={requireCommercialName} autoNamedLabel="No system name is required here. The app will generate one from the unit and equipment type." />
      <SharedSiteFields prefix={prefix} />
    </>
  )
}

function AddSystemForLocationModal({
  customerId,
  locationId,
  onClose,
  action,
}: {
  customerId: string
  locationId: string
  onClose: () => void
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
}) {
  const [error, setError] = useState<string | null>(null)
  const [systemType, setSystemType] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('location_id', locationId)
    formData.set('customer_id', customerId)

    startTransition(async () => {
      const result = await action(formData)
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '540px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a18', marginBottom: '16px' }}>Add System</div>

        {error && (
          <div style={{ background: '#fce8e8', border: '1px solid #f7c1c1', borderRadius: '7px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#a32d2d' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={modalLabelStyle}>Equipment type *</label>
              <select
                name="system_type"
                required
                style={inputStyle}
                value={systemType}
                onChange={e => setSystemType(e.target.value)}
              >
                <option value="">- select -</option>
                {SYSTEM_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <AdaptiveSystemFields systemType={systemType} requireCommercialName />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #d3d1c7', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: 'none', background: '#185fa5', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? 'Creating...' : 'Create system'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddUnitWithSystemModal({
  customerId,
  locationId,
  onClose,
  action,
}: {
  customerId: string
  locationId: string
  onClose: () => void
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
}) {
  const [error, setError] = useState<string | null>(null)
  const [systemType, setSystemType] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('location_id', locationId)
    formData.set('customer_id', customerId)

    startTransition(async () => {
      const result = await action(formData)
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '540px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a18', marginBottom: '16px' }}>Add Unit</div>

        {error && (
          <div style={{ background: '#fce8e8', border: '1px solid #f7c1c1', borderRadius: '7px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#a32d2d' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={modalLabelStyle}>Unit name *</label>
              <input name="unit_name" required placeholder='e.g. "Apt 101" or "Suite 3B"' style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={modalLabelStyle}>Unit type</label>
                <select name="unit_type" style={inputStyle} defaultValue="">
                  <option value="">- select -</option>
                  <option value="apartment">Apartment</option>
                  <option value="suite">Suite</option>
                  <option value="floor">Floor</option>
                  <option value="main">Main</option>
                </select>
              </div>
              <div>
                <label style={modalLabelStyle}>Unit notes</label>
                <input name="unit_notes" style={inputStyle} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e1da', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ fontSize: '12px', color: '#888780', fontWeight: 600, marginBottom: '8px' }}>System info (optional)</div>
            </div>

            <div>
              <label style={modalLabelStyle}>Equipment type</label>
              <select
                name="sys_system_type"
                style={inputStyle}
                value={systemType}
                onChange={e => setSystemType(e.target.value)}
              >
                <option value="">- none yet -</option>
                {SYSTEM_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <AdaptiveSystemFields systemType={systemType} prefix="sys_" requireCommercialName={false} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #d3d1c7', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: 'none', background: '#185fa5', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? 'Creating...' : 'Create unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditableSystemCard({
  sys,
  customerId,
  locationId,
  updateSystemAction,
}: {
  sys: SystemRecord
  customerId: string
  locationId: string
  updateSystemAction: Props['updateSystemAction']
}) {
  const [sysData, setSysData] = useState({ ...sys })
  const [editingField, setEditingField] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)

  async function saveField(key: string, value: unknown) {
    setSysData(prev => ({ ...prev, [key]: value }))
    setEditingField(null)
    setSavingField(key)
    await updateSystemAction(sys.id, customerId, locationId, sys._unitId, { [key]: value })
    setSavingField(null)
  }

  function editText(key: keyof SystemRecord, label: string) {
    const val = sysData[key] as string | null
    const isEditing = editingField === key
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>{label}</div>
        {isEditing ? (
          <input autoFocus defaultValue={val ?? ''} onBlur={e => saveField(key, e.target.value.trim() || null)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={ACTIVE_INPUT} />
        ) : (
          <div onClick={() => setEditingField(key)} style={{ fontSize: '13px', color: val ? '#1a1a18' : '#b4b2a9', cursor: 'text' }}>
            {val || '- tap to add'}
            <SaveHint active={savingField === key} />
          </div>
        )}
      </div>
    )
  }

  function editSelect(key: keyof SystemRecord, label: string, options: readonly { value: string; label: string }[]) {
    const val = sysData[key] as string | null
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>{label}</div>
        <select value={val ?? ''} onChange={e => saveField(key, e.target.value || null)} style={{ ...ACTIVE_INPUT, borderBottom: '1px solid #e2e1da' }}>
          <option value="">- select -</option>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <SaveHint active={savingField === key} />
      </div>
    )
  }

  function editMake() {
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>Make</div>
        <select value={sysData.make ?? ''} onChange={e => saveField('make', e.target.value || null)} style={{ ...ACTIVE_INPUT, borderBottom: '1px solid #e2e1da' }}>
          <option value="">- select -</option>
          {MAKE_OPTIONS.map(make => <option key={make} value={make}>{make}</option>)}
        </select>
        <SaveHint active={savingField === 'make'} />
      </div>
    )
  }

  function editTonnage() {
    const val = sysData.tonnage
    const isEditing = editingField === 'tonnage'
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>Tonnage</div>
        {isEditing ? (
          <input autoFocus type="number" step="0.5" min="0" defaultValue={val ?? ''} onBlur={e => saveField('tonnage', e.target.value ? parseFloat(e.target.value) : null)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={ACTIVE_INPUT} />
        ) : (
          <div onClick={() => setEditingField('tonnage')} style={{ fontSize: '13px', color: val != null ? '#1a1a18' : '#b4b2a9', cursor: 'text' }}>
            {val != null ? `${val} tons` : '- tap to add'}
            <SaveHint active={savingField === 'tonnage'} />
          </div>
        )}
      </div>
    )
  }

  const manufactureLabel = useMemo(() => formatStoredDate(sysData.manufacture_date), [sysData.manufacture_date])

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a18' }}>{sysData.name}</div>
          {sysData.system_type && <span style={{ fontSize: '10px', background: '#f1efe8', color: '#5f5e5a', borderRadius: '4px', padding: '1px 6px' }}>{SYSTEM_TYPE_LABEL[sysData.system_type] ?? sysData.system_type}</span>}
          {sysData.system_subtype && <span style={{ fontSize: '10px', background: '#e6f1fb', color: '#185fa5', borderRadius: '4px', padding: '1px 6px' }}>{sysData.system_subtype}</span>}
          {sysData.group_name && <span style={{ fontSize: '10px', color: '#888780' }}>{sysData.group_name}</span>}
        </div>

        {editText('name', 'Equipment label')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {editSelect('system_subtype', 'Subtype', SYSTEM_SUBTYPE_OPTIONS)}
          {editText('group_name', 'Group / heat pump label')}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
        {editMake()}
        {editText('model', 'Model')}
        {editText('serial_number', 'Serial')}
        {editTonnage()}
        {editSelect('refrigerant_type', 'Refrigerant', REFRIGERANT_OPTIONS)}
        {editSelect('metering_device', 'Metering', METERING_OPTIONS)}
        <div style={FIELD_WRAP}>
          <div style={LABEL_STYLE}>Manufacture date</div>
          <div style={{ fontSize: '13px', color: manufactureLabel ? '#1a1a18' : '#b4b2a9' }}>
            {manufactureLabel ?? '- derived when supported'}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e2e1da', marginTop: '8px', paddingTop: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
          {editText('served_areas', 'Areas served')}
          {editText('thermostat_location', 'Thermostat location')}
          {editText('equipment_location', 'Equipment location')}
          {editText('controls_notes', 'Controls / access notes')}
        </div>
        {editText('notes', 'General notes')}
      </div>
    </div>
  )
}

export default function LocationDetail({
  location,
  customerId,
  customerType,
  flatSystems,
  updateLocationAction,
  createSystemForLocationAction,
  createUnitWithSystemAction,
  updateSystemAction,
}: Props) {
  const router = useRouter()
  const customer = location.customers
  const flat = customerType === 'commercial' || customerType === 'facilities_provider'
  const [editingField, setEditingField] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const [locData, setLocData] = useState({
    name: location.name,
    street_address: location.street_address,
    city: location.city,
    state: location.state,
    zip: location.zip,
    access_notes: location.access_notes,
    tax_rate: location.tax_rate,
  })

  async function saveField(key: string, value: unknown) {
    setLocData(prev => ({ ...prev, [key]: value }))
    setEditingField(null)
    setSavingField(key)
    await updateLocationAction(location.id, customerId, { [key]: value })
    setSavingField(null)
  }

  function editableText(key: keyof typeof locData, label: string) {
    const val = locData[key] as string | null
    const isEditing = editingField === key
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>{label}</div>
        {isEditing ? (
          <input autoFocus defaultValue={val ?? ''} onBlur={e => saveField(key, e.target.value.trim() || null)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={ACTIVE_INPUT} />
        ) : (
          <div onClick={() => setEditingField(key)} style={{ fontSize: '13px', color: val ? '#1a1a18' : '#b4b2a9', cursor: 'text' }}>
            {val || '- tap to add'}
            <SaveHint active={savingField === key} />
          </div>
        )}
      </div>
    )
  }

  function editableNumber(key: keyof typeof locData, label: string, step: string) {
    const val = locData[key] as number | null
    const isEditing = editingField === key
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>{label}</div>
        {isEditing ? (
          <input autoFocus type="number" step={step} defaultValue={val ?? ''} onBlur={e => { const next = e.target.value.trim(); saveField(key, next ? parseFloat(next) : null) }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={ACTIVE_INPUT} />
        ) : (
          <div onClick={() => setEditingField(key)} style={{ fontSize: '13px', color: val != null ? '#1a1a18' : '#b4b2a9', cursor: 'text' }}>
            {val != null ? `${(val * 100).toFixed(2)}%` : '- tap to add'}
            <SaveHint active={savingField === key} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '16px' }}>
      <div style={{ fontSize: '12px', color: '#888780', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <span onClick={() => router.push('/customers')} style={{ cursor: 'pointer', color: '#185fa5' }}>Customers</span>
        <span>{'>'}</span>
        {customer && (
          <>
            <span onClick={() => router.push(`/customers/${customerId}`)} style={{ cursor: 'pointer', color: '#185fa5' }}>{customer.name}</span>
            <span>{'>'}</span>
          </>
        )}
        <span style={{ color: '#1a1a18' }}>{locData.name}</span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: '#b4b2a9', marginBottom: '8px' }}>Tap any field to edit</div>

        {editableText('name', 'Name')}
        {editableText('street_address', 'Street address')}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: '8px' }}>
          {editableText('city', 'City')}
          {editableText('state', 'State')}
          {editableText('zip', 'ZIP')}
        </div>

        {editableText('access_notes', 'Access notes')}
        {editableNumber('tax_rate', 'Tax rate', '0.0001')}
      </div>

      {locData.access_notes && (
        <div style={{ background: '#faeeda', border: '1px solid #f5c97a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#633806' }}>
          <strong>Access notes:</strong> {locData.access_notes}
        </div>
      )}

      {flat && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Systems ({flatSystems?.length ?? 0})
            </div>
            <button onClick={() => setShowAddModal(true)} style={{ background: '#185fa5', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add
            </button>
          </div>

          {(!flatSystems || flatSystems.length === 0) && (
            <div style={{ fontSize: '13px', color: '#888780' }}>No systems on record.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(flatSystems ?? []).map(sys => (
              <EditableSystemCard
                key={sys.id}
                sys={sys}
                customerId={customerId}
                locationId={location.id}
                updateSystemAction={updateSystemAction}
              />
            ))}
          </div>

          {showAddModal && (
            <AddSystemForLocationModal
              customerId={customerId}
              locationId={location.id}
              onClose={() => setShowAddModal(false)}
              action={createSystemForLocationAction}
            />
          )}
        </>
      )}

      {!flat && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Units ({location.units.length})
            </div>
            <button onClick={() => setShowAddModal(true)} style={{ background: '#185fa5', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add
            </button>
          </div>

          {location.units.length === 0 && (
            <div style={{ fontSize: '13px', color: '#888780' }}>No units on record.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {location.units.map(unit => {
              const sysCount = unit.systems?.length ?? 0
              return (
                <div
                  key={unit.id}
                  onClick={() => router.push(`/customers/${customerId}/${location.id}/${unit.id}`)}
                  style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '8px', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a18', marginBottom: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {unit.name}
                      {unit.unit_type && (
                        <span style={{ fontSize: '10px', background: '#f5f4f0', color: '#5f5e5a', borderRadius: '4px', padding: '1px 5px' }}>
                          {UNIT_TYPE_LABEL[unit.unit_type] ?? unit.unit_type}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#888780', flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#5f5e5a' }}>{sysCount}</div>
                    <div style={{ fontSize: '10px' }}>{sysCount === 1 ? 'system' : 'systems'}</div>
                  </div>
                  <div style={{ color: '#b4b2a9', fontSize: '14px', flexShrink: 0 }}>{'>'}</div>
                </div>
              )
            })}
          </div>

          {showAddModal && (
            <AddUnitWithSystemModal
              customerId={customerId}
              locationId={location.id}
              onClose={() => setShowAddModal(false)}
              action={createUnitWithSystemAction}
            />
          )}
        </>
      )}
    </div>
  )
}
