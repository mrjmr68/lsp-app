'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AppShellProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/planning',  label: 'Planning'  },
  { href: '/jobs',      label: 'Jobs'      },
  { href: '/admin',     label: 'Admin'     },
  { href: '/invoices',  label: 'Invoices'  },
  { href: '/customers', label: 'Customers' },
]

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

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
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        minHeight: '64px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
      }}>
        {/* App name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.05em', color: '#f5efd9', textTransform: 'uppercase' }}>
              Legend Service Pros
            </div>
            <div style={{ fontSize: '10px', color: '#d1c39a', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
              Trusted apartment heating and air experts
            </div>
          </div>
        </div>

        {/* Divider */}
        <span style={{ width: 1, height: 28, background: 'rgba(243, 228, 188, 0.24)', flexShrink: 0 }} />

        {/* Nav */}
        <nav style={{ display: 'flex', gap: '4px' }}>
          {navItems.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: '13px',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#1b1e23' : '#efe7cb',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  background: active ? '#ead39f' : 'rgba(255,255,255,0.06)',
                  border: active ? '1px solid rgba(234, 211, 159, 0.9)' : '1px solid rgba(255,255,255,0.08)',
                  textDecoration: 'none',
                  transition: 'background 0.1s',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

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
