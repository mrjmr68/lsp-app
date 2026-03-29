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
}

interface Unit {
  id: string
  name: string
  unit_type: string | null
  notes: string | null
  locations: {
    id: string
    name: string
    customer_id: string
    customers: { id: string; name: string; type: string | null } | null
  } | null
  systems: SystemRecord[]
}

interface Props {
  unit: Unit
  customerId: string
  locationId: string
  updateUnitAction: (unitId: string, customerId: string, locationId: string, fields: Record<string, unknown>) => Promise<{ error?: string; success?: boolean }>
  createSystemAction: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>
  updateSystemAction: (systemId: string, customerId: string, locationId: string, unitId: string, fields: Record<string, unknown>) => Promise<{ error?: string; success?: boolean }>
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

const SYSTEM_TYPE_LABEL: Record<string, string> = {
  rtu: 'RTU',
  heat_pump: 'Heat Pump',
  ptac: 'PTAC',
  air_handler: 'Air Handler',
  condensing_unit: 'Condensing Unit',
}

function SaveHint({ active }: { active: boolean }) {
  if (!active) return null
  return <span style={{ fontSize: '10px', color: '#888780', marginLeft: '6px' }}>saving...</span>
}

function SharedSiteFields() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Areas served</label>
          <input name="served_areas" placeholder="Bedroom loop, suite front offices..." style={inputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Thermostat location</label>
          <input name="thermostat_location" placeholder="Hallway, reception desk..." style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Equipment location</label>
          <input name="equipment_location" placeholder="Closet, above ceiling, roof..." style={inputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Controls notes</label>
          <input name="controls_notes" placeholder="Zone controller, above ceiling relay..." style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={modalLabelStyle}>General notes</label>
        <textarea name="notes" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    </>
  )
}

function SingleSystemFields({ autoNamedLabel }: { autoNamedLabel: string }) {
  return (
    <>
      <div style={{ fontSize: '12px', color: '#888780' }}>{autoNamedLabel}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Make</label>
          <select name="make" style={inputStyle} defaultValue="">
            <option value="">- select -</option>
            {MAKE_OPTIONS.map(make => <option key={make} value={make}>{make}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Model</label>
          <input name="model" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Serial number</label>
          <input name="serial_number" style={inputStyle} />
        </div>
        <div>
          <label style={modalLabelStyle}>Tonnage</label>
          <input name="tonnage" type="number" step="0.5" min="0" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={modalLabelStyle}>Refrigerant</label>
          <select name="refrigerant_type" style={inputStyle} defaultValue="">
            <option value="">- select -</option>
            {REFRIGERANT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label style={modalLabelStyle}>Metering device</label>
          <select name="metering_device" style={inputStyle} defaultValue="">
            <option value="">- select -</option>
            {METERING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>
    </>
  )
}

function HeatPumpFields() {
  return (
    <>
      <div>
        <label style={modalLabelStyle}>Heat pump label</label>
        <input name="group_name" placeholder='e.g. "Heat Pump A"' style={inputStyle} />
      </div>

      <div style={{ borderTop: '1px solid #e2e1da', paddingTop: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a18', marginBottom: '8px' }}>Condensing Unit</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={modalLabelStyle}>Make</label>
            <select name="outdoor_make" style={inputStyle} defaultValue="">
              <option value="">- select -</option>
              {MAKE_OPTIONS.map(make => <option key={make} value={make}>{make}</option>)}
            </select>
          </div>
          <div>
            <label style={modalLabelStyle}>Model</label>
            <input name="outdoor_model" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={modalLabelStyle}>Serial number</label>
            <input name="outdoor_serial_number" style={inputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Tonnage</label>
            <input name="outdoor_tonnage" type="number" step="0.5" min="0" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={modalLabelStyle}>Refrigerant</label>
            <select name="outdoor_refrigerant_type" style={inputStyle} defaultValue="">
              <option value="">- select -</option>
              {REFRIGERANT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label style={modalLabelStyle}>Metering device</label>
            <select name="outdoor_metering_device" style={inputStyle} defaultValue="">
              <option value="">- select -</option>
              {METERING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e2e1da', paddingTop: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a18', marginBottom: '8px' }}>Air Handler</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={modalLabelStyle}>Make</label>
            <select name="indoor_make" style={inputStyle} defaultValue="">
              <option value="">- select -</option>
              {MAKE_OPTIONS.map(make => <option key={make} value={make}>{make}</option>)}
            </select>
          </div>
          <div>
            <label style={modalLabelStyle}>Model</label>
            <input name="indoor_model" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={modalLabelStyle}>Serial number</label>
            <input name="indoor_serial_number" style={inputStyle} />
          </div>
          <div>
            <label style={modalLabelStyle}>Tonnage</label>
            <input name="indoor_tonnage" type="number" step="0.5" min="0" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={modalLabelStyle}>Refrigerant</label>
            <select name="indoor_refrigerant_type" style={inputStyle} defaultValue="">
              <option value="">- select -</option>
              {REFRIGERANT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label style={modalLabelStyle}>Metering device</label>
            <select name="indoor_metering_device" style={inputStyle} defaultValue="">
              <option value="">- select -</option>
              {METERING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </>
  )
}

function AddSystemModal({
  customerId,
  locationId,
  unitId,
  onClose,
  action,
}: {
  customerId: string
  locationId: string
  unitId: string
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
    formData.set('unit_id', unitId)
    formData.set('customer_id', customerId)
    formData.set('location_id', locationId)

    startTransition(async () => {
      const result = await action(formData)
      if (result.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '540px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a18', marginBottom: '16px' }}>Add System Info</div>

        {error && (
          <div style={{ background: '#fce8e8', border: '1px solid #f7c1c1', borderRadius: '7px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#a32d2d' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={modalLabelStyle}>Equipment type *</label>
              <select name="system_type" required style={inputStyle} value={systemType} onChange={e => setSystemType(e.target.value)}>
                <option value="">- select -</option>
                {SYSTEM_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            {systemType === 'heat_pump' ? (
              <>
                <HeatPumpFields />
                <SharedSiteFields />
              </>
            ) : systemType ? (
              <>
                <SingleSystemFields autoNamedLabel="No system name is required here. The app will generate one from the unit and equipment type." />
                <SharedSiteFields />
              </>
            ) : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #d3d1c7', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={isPending} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '7px', border: 'none', background: '#185fa5', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? 'Creating...' : 'Add system'}
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
  unitId,
  updateSystemAction,
}: {
  sys: SystemRecord
  customerId: string
  locationId: string
  unitId: string
  updateSystemAction: Props['updateSystemAction']
}) {
  const [sysData, setSysData] = useState({ ...sys })
  const [editingField, setEditingField] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)

  async function saveField(key: string, value: unknown) {
    setSysData(prev => ({ ...prev, [key]: value }))
    setEditingField(null)
    setSavingField(key)
    await updateSystemAction(sys.id, customerId, locationId, unitId, { [key]: value })
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a18' }}>{sysData.name}</div>
        {sysData.system_type && <span style={{ fontSize: '10px', background: '#f1efe8', color: '#5f5e5a', borderRadius: '4px', padding: '1px 6px' }}>{SYSTEM_TYPE_LABEL[sysData.system_type] ?? sysData.system_type}</span>}
        {sysData.system_subtype && <span style={{ fontSize: '10px', background: '#e6f1fb', color: '#185fa5', borderRadius: '4px', padding: '1px 6px' }}>{sysData.system_subtype}</span>}
        {sysData.group_name && <span style={{ fontSize: '10px', color: '#888780' }}>{sysData.group_name}</span>}
      </div>

      {editText('name', 'Equipment label')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
        {editSelect('system_subtype', 'Subtype', SYSTEM_SUBTYPE_OPTIONS)}
        {editText('group_name', 'Group / heat pump label')}
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

export default function UnitDetail({ unit, customerId, locationId, updateUnitAction, createSystemAction, updateSystemAction }: Props) {
  const router = useRouter()
  const location = unit.locations
  const customer = location?.customers

  const [editingField, setEditingField] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [showAddSystem, setShowAddSystem] = useState(false)

  const [unitData, setUnitData] = useState({
    name: unit.name,
    unit_type: unit.unit_type,
    notes: unit.notes,
  })

  async function saveUnitField(key: string, value: unknown) {
    setUnitData(prev => ({ ...prev, [key]: value }))
    setEditingField(null)
    setSavingField(key)
    await updateUnitAction(unit.id, customerId, locationId, { [key]: value })
    setSavingField(null)
  }

  function editableText(key: keyof typeof unitData, label: string) {
    const val = unitData[key] as string | null
    const isEditing = editingField === key
    return (
      <div style={FIELD_WRAP}>
        <div style={LABEL_STYLE}>{label}</div>
        {isEditing ? (
          <input autoFocus defaultValue={val ?? ''} onBlur={e => saveUnitField(key, e.target.value.trim() || null)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={ACTIVE_INPUT} />
        ) : (
          <div onClick={() => setEditingField(key)} style={{ fontSize: '13px', color: val ? '#1a1a18' : '#b4b2a9', cursor: 'text' }}>
            {val || '- tap to add'}
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
        {location && (
          <>
            <span onClick={() => router.push(`/customers/${customerId}/${locationId}`)} style={{ cursor: 'pointer', color: '#185fa5' }}>{location.name}</span>
            <span>{'>'}</span>
          </>
        )}
        <span style={{ color: '#1a1a18' }}>{unitData.name}</span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: '#b4b2a9', marginBottom: '8px' }}>Tap any field to edit</div>

        {editableText('name', 'Unit name')}

        <div style={FIELD_WRAP}>
          <div style={LABEL_STYLE}>Unit type</div>
          <select
            value={unitData.unit_type ?? ''}
            onChange={e => saveUnitField('unit_type', e.target.value || null)}
            style={{ ...ACTIVE_INPUT, borderBottom: '1px solid #e2e1da' }}
          >
            <option value="">- none -</option>
            <option value="apartment">Apartment</option>
            <option value="suite">Suite</option>
            <option value="floor">Floor</option>
            <option value="main">Main</option>
          </select>
          <SaveHint active={savingField === 'unit_type'} />
        </div>

        {editableText('notes', 'Unit notes')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          System info ({unit.systems.length})
        </div>
        <button
          onClick={() => setShowAddSystem(true)}
          style={{ background: '#185fa5', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Add system info
        </button>
      </div>

      {unit.systems.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e1da', borderRadius: '10px', padding: '16px', fontSize: '13px', color: '#888780', textAlign: 'center' }}>
          No system info on record.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {unit.systems.map(system => (
            <EditableSystemCard
              key={system.id}
              sys={system}
              customerId={customerId}
              locationId={locationId}
              unitId={unit.id}
              updateSystemAction={updateSystemAction}
            />
          ))}
        </div>
      )}

      {showAddSystem && (
        <AddSystemModal
          customerId={customerId}
          locationId={locationId}
          unitId={unit.id}
          onClose={() => setShowAddSystem(false)}
          action={createSystemAction}
        />
      )}
    </div>
  )
}
