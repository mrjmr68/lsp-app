'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface JobShellProps {
  jobId: string
  title: string
  situation: string
  arrivedAt: string | null
  children: React.ReactNode
}

function useElapsed(arrivedAt: string | null) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (!arrivedAt) return
    const start = new Date(arrivedAt).getTime()
    const tick = () => setSecs(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [arrivedAt])

  return secs
}

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

export default function JobShell({ jobId, title, situation, arrivedAt, children }: JobShellProps) {
  const pathname = usePathname()
  const elapsed = useElapsed(arrivedAt)
  const onJobHome = pathname === `/jobs/${jobId}`

  return (
    <div className="flex min-h-screen flex-col bg-stone-100 text-stone-900">
      <header className="sticky top-0 z-50 shrink-0 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href={onJobHome ? '/jobs' : `/jobs/${jobId}`}
            className="shrink-0 text-sm font-semibold text-blue-700 no-underline"
          >
            {onJobHome ? '← Today' : '← Job'}
          </Link>

          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-sm font-bold">{title}</div>
          </div>

          <span
            className={[
              'shrink-0 font-mono text-sm font-semibold',
              arrivedAt ? 'text-amber-800' : 'text-stone-400',
            ].join(' ')}
          >
            {arrivedAt ? fmt(elapsed) : '--:--'}
          </span>
        </div>
        <div className="mx-auto max-w-lg border-t border-stone-100 px-4 py-2 text-xs leading-snug text-stone-600">
          {situation}
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
