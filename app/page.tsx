import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('first_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const today = new Date().toISOString().split('T')[0]
  const canViewAll = ['owner', 'admin', 'dispatcher'].includes(profile?.role ?? '')

  let todayQuery = supabase
    .from('service_visits')
    .select('id', { count: 'exact', head: true })
    .eq('scheduled_date', today)
    .neq('status', 'cancelled')
    .neq('status', 'completed')

  if (!canViewAll) {
    todayQuery = todayQuery.eq('assigned_tech', user.id)
  }

  const [
    { count: activeVisitsCount },
    { count: waitingPartsCount },
    { count: readyForInvoiceCount },
  ] = await Promise.all([
    todayQuery,
    supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'waiting_parts'),
    supabase
      .from('service_visits')
      .select('id', { count: 'exact', head: true })
      .eq('billing_status', 'ready_for_invoice'),
  ])

  const quickActions = [
    {
      href: '/today',
      label: "Today's Jobs",
      metric: activeVisitsCount ?? 0,
      description: 'Assigned service visits, ordered for field work.',
      tone: '#202329',
      color: '#fff8df',
    },
    {
      href: '/quick-add',
      label: 'Add Job',
      metric: '+',
      description: 'Create a request and first visit from a call or text.',
      tone: '#ead39f',
      color: '#1b1e23',
    },
    {
      href: '/quick-update',
      label: 'Update Job',
      metric: 'Note',
      description: 'Add notes, access facts, timing, or status changes fast.',
      tone: '#dce6ed',
      color: '#213747',
    },
    {
      href: '/estimates',
      label: 'Parts / Waiting',
      metric: waitingPartsCount ?? 0,
      description: 'Review work blocked by parts or follow-up scheduling.',
      tone: '#f2dfc4',
      color: '#5b3c1f',
    },
    {
      href: '/invoices',
      label: 'Dashboard',
      metric: readyForInvoiceCount ?? 0,
      description: 'Invoice-ready work and owner review queues.',
      tone: '#e4eadc',
      color: '#31452e',
    },
  ]

  return (
    <AppShell>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 14px 42px' }}>
        <header style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6a655c', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Legend Service Pros
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: 34, lineHeight: 1.04, color: '#202329' }}>
            {profile?.first_name ? `Good to see you, ${profile.first_name}.` : 'Field operations home'}
          </h1>
          <p style={{ margin: '9px 0 0', maxWidth: 660, color: '#5d584f', lineHeight: 1.5 }}>
            The v1.0 workflow starts here: today&apos;s visits, fast intake, quick updates, waiting parts, and invoice-ready review.
          </p>
        </header>

        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          marginBottom: 22,
        }}>
          {quickActions.map(action => (
            <Link
              key={action.href}
              href={action.href}
              style={{
                minHeight: 152,
                display: 'grid',
                alignContent: 'space-between',
                gap: 16,
                padding: 16,
                borderRadius: 8,
                border: '1px solid rgba(31, 34, 39, 0.18)',
                background: '#fffdf8',
                color: '#202329',
                textDecoration: 'none',
                boxShadow: '0 10px 22px rgba(43, 46, 52, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.15 }}>{action.label}</h2>
                <span style={{
                  minWidth: 38,
                  height: 32,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 9px',
                  background: action.tone,
                  color: action.color,
                  fontSize: 13,
                  fontWeight: 900,
                }}>
                  {action.metric}
                </span>
              </div>
              <p style={{ margin: 0, color: '#625d54', lineHeight: 1.4, fontSize: 13 }}>
                {action.description}
              </p>
            </Link>
          ))}
        </section>

        <section style={{
          border: '1px solid #d7d0c1',
          background: 'rgba(255, 253, 248, 0.72)',
          borderRadius: 8,
          padding: 16,
          display: 'grid',
          gap: 10,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#202329' }}>Build 1 lane</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
            gap: 8,
            color: '#58544d',
            fontSize: 13,
            lineHeight: 1.35,
          }}>
            {['New request', 'Technician assignment', "Today's Jobs", 'Active Visit', 'Repair or parts', 'Invoice-ready'].map((step, index) => (
              <div
                key={step}
                style={{
                  border: '1px solid #ddd5c8',
                  borderRadius: 6,
                  padding: 10,
                  background: index === 2 ? '#202329' : '#fffdf8',
                  color: index === 2 ? '#fff8df' : '#373a40',
                  fontWeight: 800,
                }}
              >
                {step}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
