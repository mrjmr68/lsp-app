'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface OfficeShellProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/planning', label: 'Planning' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/admin', label: 'Admin' },
  { href: '/estimates', label: 'Estimates' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/customers', label: 'Customers' },
]

export default function OfficeShell({ children }: OfficeShellProps) {
  const pathname = usePathname()
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const sync = () => setIsCompact(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ece7dc] via-[#f5f1e7] to-[#f0ebe1] text-stone-900">
      <header className="sticky top-0 z-50 border-b border-stone-900 bg-gradient-to-b from-[#2b2e34] to-[#191c21] shadow-lg">
        <div
          className={[
            'flex items-center gap-5 px-6',
            isCompact ? 'flex-col items-stretch gap-3 py-3 px-3.5' : 'min-h-16',
          ].join(' ')}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 min-w-[54px] items-center justify-center rounded-[10px] border border-black/25 bg-gradient-to-b from-[#f3e4bc] to-[#dcc38d] text-base font-extrabold tracking-wider text-stone-900 shadow-inner">
              LSP
            </div>
            <div className="min-w-0">
              <div className={`font-extrabold uppercase tracking-wide text-[#f5efd9] ${isCompact ? 'text-sm' : 'text-base'}`}>
                Legend Service Pros
              </div>
              {!isCompact && (
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#d1c39a]">
                  Trusted apartment heating and air experts
                </div>
              )}
            </div>
          </div>

          {!isCompact && <span className="h-7 w-px shrink-0 bg-[#f3e4bc]/25" />}

          <nav className={`flex gap-1 ${isCompact ? 'w-full flex-wrap' : 'overflow-x-auto'}`}>
            {navItems.map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'rounded-full border px-3.5 py-2 text-[13px] no-underline transition-colors',
                    isCompact ? 'flex-1 basis-[calc(50%-4px)] text-center' : 'shrink-0',
                    active
                      ? 'border-[#ead39f]/90 bg-[#ead39f] font-bold text-stone-900'
                      : 'border-white/10 bg-white/5 font-medium text-[#efe7cb]',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {!isCompact && <div className="flex-1" />}

          <a
            href="/auth/signout"
            className={`rounded-full border border-[#f3e4bc]/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f5efd9] no-underline ${isCompact ? 'self-start' : ''}`}
          >
            Sign out
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
