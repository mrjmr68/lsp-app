import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import { createClient } from '@/utils/supabase/server'
import { firstRelation, SupabaseRelation } from '@/utils/supabase/relations'

type VisitStatus = 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'cancelled'
type BillingStatus = 'not_ready' | 'blocked_parts_return' | 'ready_for_invoice' | 'invoiced' | 'not_billable'

type VisitRequestRelation = {
  id: string
  priority: 'routine' | 'urgent' | 'emergency'
  problem_description: string | null
  manual_unit: string | null
  access_notes: string | null
  request_kind: 'service_call' | 'add_unit'
  status: string
  customers: SupabaseRelation<{ name: string }>
  locations: SupabaseRelation<{ name: string }>
  units: SupabaseRelation<{ name: string }>
}

type VisitUserRelation = {
  first_name: string
  last_name: string
  role: string
}

type RawVisit = {
  id: string
  legacy_job_id: string | null
  status: VisitStatus
  outcome: string | null
  billing_status: BillingStatus
  scheduled_date: string | null
  queue_position: number | null
  access_confirmed: boolean
  access_confirmation_needed: boolean
  needs_return_visit: boolean
  arrived_at: string | null
  completed_at: string | null
  service_requests: SupabaseRelation<VisitRequestRelation>
  assigned_user: SupabaseRelation<VisitUserRelation>
}

type VisitCard = {
  id: string
  legacyJobId: string | null
  status: VisitStatus
  outcome: string | null
  billingStatus: BillingStatus
  queuePosition: number | null
  accessConfirmed: boolean
  accessConfirmationNeeded: boolean
  needsReturnVisit: boolean
  arrivedAt: string | null
  completedAt: string | null
  requestId: string | null
  priority: string
  problemDescription: string | null
  unitLabel: string
  requestKind: string
  customerName: string
  locationName: string
  assignedTechName: string
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

function formatTechName(user: VisitUserRelation | null) {
  if (!user) return 'Unassigned'
  return `${user.first_name} ${user.last_name}`.trim()
}

function normalizeVisit(row: RawVisit): VisitCard {
  const request = firstRelation(row.service_requests)
  const assignedUser = firstRelation(row.assigned_user)
  const customer = firstRelation(request?.customers)
  const location = firstRelation(request?.locations)
  const unit = firstRelation(request?.units)

  return {
    id: row.id,
    legacyJobId: row.legacy_job_id,
    status: row.status,
    outcome: row.outcome,
    billingStatus: row.billing_status,
    queuePosition: row.queue_position,
    accessConfirmed: row.access_confirmed,
    accessConfirmationNeeded: row.access_confirmation_needed,
    needsReturnVisit: row.needs_return_visit,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
    requestId: request?.id ?? null,
    priority: request?.priority ?? 'routine',
    problemDescription: request?.problem_description ?? null,
    unitLabel: unit?.name ?? request?.manual_unit ?? 'No unit set',
    requestKind: request?.request_kind ?? 'service_call',
    customerName: customer?.name ?? 'Unknown customer',
    locationName: location?.name ?? 'Unknown location',
    assignedTechName: formatTechName(assignedUser),
  }
}

function statusStyles(status: VisitStatus) {
  if (status === 'completed') return { background: '#e5f3df', color: '#255b2f', border: '#b9d8ad' }
  if (status === 'on_site') return { background: '#e1edf7', color: '#234d6f', border: '#afcbe0' }
  if (status === 'en_route') return { background: '#fff0cf', color: '#735019', border: '#e4ca91' }
  if (status === 'cancelled') return { background: '#f2e0dc', color: '#783326', border: '#ddb8af' }
  return { background: '#f1eee6', color: '#4b4b46', border: '#d8d1c4' }
}

function priorityStyles(priority: string) {
  if (priority === 'emergency') return { background: '#ffe3de', color: '#8b2519', border: '#e9b2a8' }
  if (priority === 'urgent') return { background: '#fff2c2', color: '#715314', border: '#dec276' }
  return { background: '#edf0e7', color: '#3f503b', border: '#cdd5c5' }
}

function badge(label: string, colors: { background: string; color: string; border: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 24,
      padding: '3px 8px',
      borderRadius: 6,
      border: `1px solid ${colors.border}`,
      background: colors.background,
      color: colors.color,
      fontSize: 12,
      fontWeight: 800,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function VisitRow({ visit }: { visit: VisitCard }) {
  const detailHref = `/visits/${visit.id}`

  return (
    <article style={{
      border: '1px solid #d6d0c4',
      background: '#fffdf8',
      borderRadius: 8,
      padding: 14,
      boxShadow: '0 8px 18px rgba(43, 46, 52, 0.06)',
      display: 'grid',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {badge(formatStatus(visit.status), statusStyles(visit.status))}
            {badge(visit.priority, priorityStyles(visit.priority))}
            {visit.requestKind === 'add_unit' && badge('add unit', { background: '#e9edf0', color: '#374653', border: '#c5cdd4' })}
            {visit.needsReturnVisit && badge('return needed', { background: '#f5e8d7', color: '#6d4220', border: '#dec4a4' })}
          </div>
          <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.2, color: '#202329' }}>
            {visit.locationName} <span style={{ color: '#68645d', fontWeight: 600 }}>- {visit.unitLabel}</span>
          </h2>
          <p style={{ margin: '5px 0 0', color: '#5b5851', lineHeight: 1.4 }}>
            {visit.problemDescription || 'No issue description recorded.'}
          </p>
        </div>

        <div style={{ textAlign: 'right', color: '#5a554c', fontSize: 12, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 800, color: '#23262b' }}>{visit.assignedTechName}</div>
          <div>{visit.queuePosition ? `Stop ${visit.queuePosition}` : 'No queue slot'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#625f58', fontSize: 12 }}>
          <span>{visit.customerName}</span>
          <span>Billing: {formatStatus(visit.billingStatus)}</span>
          <span>Access: {visit.accessConfirmed ? 'confirmed' : visit.accessConfirmationNeeded ? 'needs confirmation' : 'not flagged'}</span>
        </div>

        <Link
          href={detailHref}
          style={{
            background: '#202329',
            color: '#fff8df',
            border: '1px solid #111318',
            borderRadius: 6,
            padding: '9px 12px',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          Open visit
        </Link>
      </div>
    </article>
  )
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: pageError } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const canViewAll = ['owner', 'admin', 'dispatcher'].includes(profile?.role ?? '')

  let visitsQuery = supabase
    .from('service_visits')
    .select(`
      id,
      legacy_job_id,
      status,
      outcome,
      billing_status,
      scheduled_date,
      queue_position,
      access_confirmed,
      access_confirmation_needed,
      needs_return_visit,
      arrived_at,
      completed_at,
      service_requests!service_visits_service_request_id_fkey (
        id,
        priority,
        problem_description,
        manual_unit,
        access_notes,
        request_kind,
        status,
        customers!service_requests_customer_id_fkey ( name ),
        locations!service_requests_location_id_fkey ( name ),
        units!service_requests_unit_id_fkey ( name )
      ),
      assigned_user:users!service_visits_assigned_tech_fkey (
        first_name,
        last_name,
        role
      )
    `)
    .eq('scheduled_date', today)
    .neq('status', 'cancelled')
    .order('queue_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (!canViewAll) {
    visitsQuery = visitsQuery.eq('assigned_tech', user.id)
  }

  const { data: visits, error } = await visitsQuery
  const normalizedVisits = ((visits ?? []) as RawVisit[]).map(normalizeVisit)
  const activeVisits = normalizedVisits.filter(visit => visit.status !== 'completed')
  const completedVisits = normalizedVisits.filter(visit => visit.status === 'completed')

  return (
    <AppShell>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '22px 14px 40px' }}>
        <header style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6a655c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Today&apos;s Jobs
          </p>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05, color: '#202329' }}>
                {activeVisits.length} active visit{activeVisits.length === 1 ? '' : 's'}
              </h1>
              <p style={{ margin: '7px 0 0', color: '#5e5a52', lineHeight: 1.5 }}>
                Service-visit queue for {today}. Office roles see the full board; techs see assigned work.
              </p>
            </div>
            <Link
              href="/planning"
              style={{
                background: '#ead39f',
                color: '#1b1e23',
                border: '1px solid #d4b979',
                borderRadius: 6,
                padding: '10px 12px',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              Planning board
            </Link>
          </div>
        </header>

        {error && (
          <div style={{ border: '1px solid #e0b8ae', background: '#fff0ec', color: '#7a3125', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            Today&apos;s visit queue could not load: {error.message}
          </div>
        )}

        {pageError && (
          <div style={{ border: '1px solid #e0b8ae', background: '#fff0ec', color: '#7a3125', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            {pageError}
          </div>
        )}

        <section style={{ display: 'grid', gap: 10 }}>
          {activeVisits.length === 0 ? (
            <div style={{ border: '1px dashed #cfc7b8', background: 'rgba(255, 253, 248, 0.72)', borderRadius: 8, padding: 20, color: '#5d584f' }}>
              No active visits are scheduled for today.
            </div>
          ) : (
            activeVisits.map(visit => <VisitRow key={visit.id} visit={visit} />)
          )}
        </section>

        {completedVisits.length > 0 && (
          <section style={{ marginTop: 24, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#2a2d33' }}>Completed today</h2>
            {completedVisits.map(visit => <VisitRow key={visit.id} visit={visit} />)}
          </section>
        )}
      </div>
    </AppShell>
  )
}
