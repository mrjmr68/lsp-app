'use client'

import Link from 'next/link'

interface FieldShellProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  action?: React.ReactNode
}

export default function FieldShell({
  children,
  title = 'My Jobs',
  subtitle,
  backHref,
  backLabel = 'Back',
  action,
}: FieldShellProps) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          {backHref ? (
            <Link
              href={backHref}
              className="shrink-0 text-sm font-semibold text-blue-700 no-underline"
            >
              ← {backLabel}
            </Link>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-xs font-extrabold tracking-wider text-amber-100">
              LSP
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold">{title}</div>
            {subtitle && (
              <div className="truncate text-xs text-stone-500">{subtitle}</div>
            )}
          </div>

          {action}

          <a
            href="/auth/signout"
            className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 no-underline"
          >
            Out
          </a>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
