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
    <div>
      <label className="flex min-h-[72px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-stone-400 bg-stone-50 px-4 py-4">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={event => {
            const next = event.target.files ? Array.from(event.target.files) : []
            onChange([...files, ...next])
            event.target.value = ''
          }}
        />
        <div>
          <div className="text-sm font-bold text-stone-900">{label}</div>
          <div className="mt-0.5 text-xs text-stone-500">
            {files.length > 0 ? `${files.length} photo${files.length === 1 ? '' : 's'} ready` : 'Tap to take or add photos'}
          </div>
        </div>
        <span className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">
          Camera
        </span>
      </label>
      {files.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-2 text-xs font-semibold text-stone-500"
        >
          Clear photos
        </button>
      )}
    </div>
  )
}
