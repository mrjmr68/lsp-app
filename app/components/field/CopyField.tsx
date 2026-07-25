'use client'

import { useState } from 'react'

interface CopyFieldProps {
  label: string
  value: string
}

export default function CopyField({ label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable on some mobile browsers
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
        {label}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="text-lg font-semibold leading-snug text-stone-900">{value}</div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
