'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AppShellProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/',          label: 'Home'      },
  { href: '/today',     label: 'Today'     },
  { href: '/planning',  label: 'Planning'  },
  { href: '/jobs',      label: 'Jobs'      },
  { href: '/admin',     label: 'Admin'     },
  { href: '/estimates', label: 'Estimates' },
  { href: '/invoices',  label: 'Invoices'  },
  { href: '/customers', label: 'Customers' },
]

export default function AppShell({ children }: AppShellProps) {
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
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #ece7dc 0%, #f5f1e7 38%, #f0ebe1 100%)',
        color: '#17191d',
      }}
    >

      {/* Top bar */}
      <header style={{
        background: 'linear-gradient(180deg, #2b2e34 0%, #191c21 100%)',
        borderBottom: '1px solid #111318',
        padding: isCompact ? '12px 14px' : '0 24px',
        display: 'flex',
        flexDirection: isCompact ? 'column' : 'row',
        alignItems: isCompact ? 'stretch' : 'center',
        gap: isCompact ? '12px' : '20px',
        minHeight: isCompact ? 'auto' : '64px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
        overflowX: 'clip',
      }}>
        {/* App name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{
            minWidth: 54,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(180deg, #f3e4bc 0%, #dcc38d 100%)',
            color: '#191c21',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(0,0,0,0.26)',
            fontSize: '16px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
          }}>
            LSP
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isCompact ? '14px' : '16px', fontWeight: 800, letterSpacing: '0.05em', color: '#f5efd9', textTransform: 'uppercase' }}>
              Legend Service Pros
            </div>
            <div style={{ fontSize: '10px', color: '#d1c39a', textTransform: 'uppercase', letterSpacing: '0.16em', display: isCompact ? 'none' : 'block' }}>
              Trusted apartment heating and air experts
            </div>
          </div>
        </div>

        {/* Divider */}
        {!isCompact && (
          <span style={{ width: 1, height: 28, background: 'rgba(243, 228, 188, 0.24)', flexShrink: 0 }} />
        )}

        {/* Nav */}
        <nav style={{
          display: 'flex',
          gap: '4px',
          flexWrap: isCompact ? 'wrap' : 'nowrap',
          overflowX: isCompact ? 'visible' : 'auto',
          width: isCompact ? '100%' : 'auto',
        }}>
          {navItems.map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: '13px',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#1b1e23' : '#efe7cb',
                  padding: isCompact ? '8px 12px' : '8px 14px',
                  borderRadius: '999px',
                  background: active ? '#ead39f' : 'rgba(255,255,255,0.06)',
                  border: active ? '1px solid rgba(234, 211, 159, 0.9)' : '1px solid rgba(255,255,255,0.08)',
                  textDecoration: 'none',
                  transition: 'background 0.1s',
                  flex: isCompact ? '1 1 calc(50% - 4px)' : '0 0 auto',
                  textAlign: 'center',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        {!isCompact && <div style={{ flex: 1 }} />}

        {/* Sign out */}
        <a
          href="/auth/signout"
          style={{
            fontSize: '12px',
            color: '#f5efd9',
            textDecoration: 'none',
            padding: '7px 12px',
            borderRadius: '999px',
            border: '1px solid rgba(243, 228, 188, 0.18)',
            background: 'rgba(255,255,255,0.06)',
            fontWeight: 600,
            alignSelf: isCompact ? 'flex-start' : 'auto',
          }}
        >
          Sign out
        </a>
      </header>

      {/* Page content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

    </div>
  )
}
