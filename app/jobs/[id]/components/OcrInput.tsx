'use client'

import { useRef, useState, useCallback } from 'react'

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '14px',
  padding: '12px 10px',
  borderRadius: '12px',
  border: '1px solid #d3d1c7',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
}

export default function OcrInput({
  value,
  onChange,
  placeholder,
  label,
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
        setError('No text detected — try again or type manually')
      }
    } catch {
      setError('OCR failed — type the value manually')
    } finally {
      setScanning(false)
      // Reset file input so the same image can be re-captured
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [onChange])

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={value}
          onChange={event => onChange(event.target.value.toUpperCase())}
          placeholder={placeholder}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          style={{
            position: 'absolute',
            right: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '34px',
            height: '34px',
            border: '1px solid #d3d1c7',
            borderRadius: '8px',
            background: scanning ? '#f0ede5' : '#fff',
            cursor: scanning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            padding: 0,
            color: '#5f5e5a',
          }}
          title="Scan with camera"
        >
          {scanning ? (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#888780' }}>...</span>
          ) : (
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
          style={{ display: 'none' }}
        />
      </div>
      {scanning && (
        <div style={{
          fontSize: '11px',
          color: '#854f0b',
          marginTop: '4px',
          fontWeight: 600,
        }}>
          Scanning image...
        </div>
      )}
      {error && (
        <div style={{
          fontSize: '11px',
          color: '#a32d2d',
          marginTop: '4px',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
