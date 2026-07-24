'use client'

export default function PhotoSlot({
  label,
  files,
  onChange,
}: {
  label: string
  files: File[]
  onChange: (files: File[]) => void
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      background: '#fbf8ef',
      border: '1px dashed #b7ae98',
      borderRadius: '14px',
      padding: '14px 16px',
      cursor: 'pointer',
      color: '#403a31',
    }}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={event => onChange(event.target.files ? Array.from(event.target.files) : [])}
      />
      <div>
        <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#716a5e', marginTop: '3px' }}>
          {files.length > 0 ? `${files.length} selected` : 'Tap to add or update'}
        </div>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#8b6a26' }}>Add</span>
    </label>
  )
}
