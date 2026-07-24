'use client'

export default function SegControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string; activeColor?: { bg: string; fg: string } }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#6a6356', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(option => {
          const active = value === option.value
          const colors = option.activeColor ?? { bg: '#1f2329', fg: '#f8f3e6' }
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                minWidth: 62,
                padding: '11px 14px',
                borderRadius: '12px',
                border: active ? '1px solid transparent' : '1px solid #cfc8b8',
                background: active ? colors.bg : '#fff',
                color: active ? colors.fg : '#2a2d33',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
