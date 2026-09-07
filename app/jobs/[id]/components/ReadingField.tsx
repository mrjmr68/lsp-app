'use client'

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
      <div className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={event => onChange?.(event.target.value)}
          placeholder={placeholder ?? '—'}
          readOnly={readOnly}
          className={[
            'w-full min-h-[52px] rounded-xl border px-3 py-3 pr-10 text-center text-lg font-bold outline-none',
            readOnly
              ? 'border-stone-200 bg-stone-100 text-stone-700'
              : 'border-stone-300 bg-white text-stone-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100',
          ].join(' ')}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
