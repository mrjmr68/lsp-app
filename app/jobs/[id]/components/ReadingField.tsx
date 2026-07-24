'use client'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 10px',
  borderRadius: '12px',
  border: '1px solid #d3d1c7',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '16px',
}

export default function ReadingField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  readOnly = false,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  suffix?: string
  readOnly?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#6f685b', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          value={value}
          onChange={event => onChange?.(event.target.value)}
          placeholder={placeholder ?? '-'}
          readOnly={readOnly}
          style={{
            ...inputStyle,
            background: readOnly ? '#f6f1e6' : '#fff',
            color: value ? '#1b1f25' : '#8a8378',
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#7a7367', fontWeight: 700 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
