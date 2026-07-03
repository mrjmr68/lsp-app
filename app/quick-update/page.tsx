import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import { createClient } from '@/utils/supabase/server'
import { firstRelation, SupabaseRelation } from '@/utils/supabase/relations'
import QuickUpdateForm, { QuickUpdateVisit } from './QuickUpdateForm'
import { quickUpdateVisit } from './actions'

type RequestRelation = {
  priority: string
  problem_description: string | null
  manual_unit: string | null
  customers: SupabaseRelation<{ name: string }>
  locations: SupabaseRelation<{ name: string }>
  units: SupabaseRelation<{ name: string }>
}

type UserRelation = {
  first_name: string
  last_name: string
}

type RawVisit = {
  id: string
  status: string
  scheduled_date: string | null
  queue_position: number | null
  service_requests: SupabaseRelation<RequestRelation>
  assigned_user: SupabaseRelation<UserRelation>
}

function formatTechName(user: UserRelation | null) {
  if (!user) return 'Unassigned'
  return `${user.first_name} ${user.last_name}`.trim()
}

function normalizeVisit(row: RawVisit): QuickUpdateVisit {
  const request = firstRelation(row.service_requests)
  const customer = firstRelation(request?.customers)
  const location = firstRelation(request?.locations)
  const unit = firstRelation(request?.units)
  const assignedUser = firstRelation(row.assigned_user)
  const propertyLine = `${location?.name ?? 'Unknown property'} · ${unit?.name ?? request?.manual_unit ?? 'No unit set'}`

  return {
    id: row.id,
    label: `${propertyLine} · ${request?.problem_description ?? 'No issue recorded'}`,
    detail: `${customer?.name ?? 'Unknown customer'} · ${row.scheduled_date ?? 'No date'}${row.queue_position ? ` · stop ${row.queue_position}` : ''}`,
    status: row.status,
    priority: request?.priority ?? 'routine',
    assignedTechName: formatTechName(assignedUser),
  }
}

export default async function QuickUpdatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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
      status,
      scheduled_date,
      queue_position,
      service_requests!service_visits_service_request_id_fkey (
        priority,
        problem_description,
        manual_unit,
        customers!service_requests_customer_id_fkey ( name ),
        locations!service_requests_location_id_fkey ( name ),
        units!service_requests_unit_id_fkey ( name )
      ),
      assigned_user:users!service_visits_assigned_tech_fkey (
        first_name,
        last_name
      )
    `)
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .order('scheduled_date', { ascending: false, nullsFirst: false })
    .order('queue_position', { ascending: true, nullsFirst: false })
    .limit(120)

  if (!canViewAll) {
    visitsQuery = visitsQuery.eq('assigned_tech', user.id)
  }

  const { data: visits, error } = await visitsQuery
  const normalizedVisits = ((visits ?? []) as RawVisit[]).map(normalizeVisit)

  return (
    <AppShell>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '22px 14px 42px' }}>
        <header style={{ marginBottom: 18 }}>
          <Link
            href="/"
            style={{
              color: '#5d584f',
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            Back to Home
          </Link>
          <p style={{ margin: '18px 0 0', fontSize: 12, color: '#6a655c', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Quick Update Job
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: 32, lineHeight: 1.05, color: '#202329' }}>
            Add the fact while it is fresh.
          </h1>
          <p style={{ margin: '9px 0 0', maxWidth: 620, color: '#5d584f', lineHeight: 1.5 }}>
            Record access notes, timing changes, approvals, short notes, or simple status changes without opening the full visit workflow.
          </p>
        </header>

        {error && (
          <div style={{
            background: '#fff0ec',
            border: '1px solid #e0b8ae',
            color: '#7a3125',
            borderRadius: 8,
            padding: 12,
            marginBottom: 14,
            fontSize: 13,
            fontWeight: 700,
          }}>
            Active visits could not load: {error.message}
          </div>
        )}

        <section style={{
          border: '1px solid #d7d0c1',
          borderRadius: 8,
          background: 'rgba(255, 253, 248, 0.76)',
          padding: 16,
          boxShadow: '0 10px 22px rgba(43, 46, 52, 0.06)',
        }}>
          <QuickUpdateForm
            visits={normalizedVisits}
            quickUpdateAction={quickUpdateVisit}
          />
        </section>
      </div>
    </AppShell>
  )
}
