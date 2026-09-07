interface ChoiceOption {
  value: string
  label: string
  tone?: 'cool' | 'heat' | 'alert' | 'neutral'
}

const activeTone: Record<NonNullable<ChoiceOption['tone']>, string> = {
  cool: 'border-blue-700 bg-blue-700 text-white',
  heat: 'border-amber-800 bg-amber-800 text-white',
  alert: 'border-red-700 bg-red-700 text-white',
  neutral: 'border-stone-800 bg-stone-800 text-white',
}

export default function ChoiceGroup({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  options: ChoiceOption[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={[
                'min-h-[48px] min-w-[64px] flex-1 rounded-xl border px-3 text-sm font-semibold touch-manipulation',
                active
                  ? activeTone[option.tone ?? 'neutral']
                  : 'border-stone-300 bg-white text-stone-800',
                disabled ? 'opacity-70' : '',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
