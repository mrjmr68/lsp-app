'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface JobShellProps {
  jobId: string
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
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function JobShell({ jobId, arrivedAt, children }: JobShellProps) {
  const pathname = usePathname()
  const elapsed = useElapsed(arrivedAt)
  const onJobHome = pathname === `/jobs/${jobId}` || pathname === `/jobs/${jobId}/`

  if (onJobHome) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f5f4f0] text-[#1a1a18]">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between px-6 py-3">
        <Link
          href={`/jobs/${jobId}`}
          className="text-[15px] font-medium text-[#6b6960] no-underline"
        >
          Back
        </Link>
        {arrivedAt ? (
          <span className="font-mono text-sm font-medium text-[#6b6960]">{fmt(elapsed)}</span>
        ) : (
          <span />
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
