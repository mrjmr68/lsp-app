'use client'

import { useCallback, useRef, useState } from 'react'
import { fieldControlClass } from '@/utils/field/styles'

export default function OcrInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCapture = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setScanning(true)
    setError(null)

    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const result = await worker.recognize(file)
      const text = result.data.text.trim().toUpperCase().replace(/\n/g, ' ')
      await worker.terminate()

      if (text) {
        onChange(text)
      } else {
        setError('No text detected — try again or type it')
      }
    } catch {
      setError('OCR failed — type the value')
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [onChange])

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          autoCapitalize="characters"
          value={value}
          onChange={event => onChange(event.target.value.toUpperCase())}
          placeholder={placeholder}
          className={`${fieldControlClass} pr-14 font-semibold tracking-wide`}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          title="Scan with camera"
          className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 disabled:opacity-50"
        >
          {scanning ? '…' : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          className="hidden"
        />
      </div>
      {scanning && <div className="mt-1 text-xs font-semibold text-amber-800">Scanning label…</div>}
      {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
    </div>
  )
}
