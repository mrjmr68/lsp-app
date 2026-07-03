import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { firstRelation, SupabaseRelation } from '@/utils/supabase/relations'

type VisitRow = {
  id: string
  status: 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'cancelled'
  billing_status: string
  scheduled_date: string | null
  queue_position: number | null
  assigned_user: SupabaseRelation<{ first_name: string; last_name: string }>
  service_requests: SupabaseRelation<{
    problem_description: string | null
    customers: SupabaseRelation<{ name: string }>
    locations: SupabaseRelation<{ name: string; street_address: string | null }>
  }>
}

function statusClass(status: VisitRow['status']) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (status === 'on_site') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (status === 'en_route') return 'bg-sky-100 text-sky-800 border-sky-200'
  if (status === 'cancelled') return 'bg-red-100 text-red-800 border-red-200'
  return 'bg-neutral-100 text-neutral-700 border-neutral-200'
}

function crewName(user: { first_name: string; last_name: string } | null) {
  if (!user) return 'Unassigned'
  return `${user.first_name} ${user.last_name}`.trim()
}

export default async function DailyBoard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: pageError } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const { data: visits, error } = await supabase
    .from('service_visits')
    .select(`
      id,
      status,
      billing_status,
      scheduled_date,
      queue_position,
      assigned_user:users!service_visits_assigned_tech_fkey(first_name, last_name),
      service_requests!service_visits_service_request_id_fkey(
        problem_description,
        customers!service_requests_customer_id_fkey(name),
        locations!service_requests_location_id_fkey(name, street_address)
      )
    `)
    .eq('scheduled_date', today)
    .neq('status', 'cancelled')
    .order('queue_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  const rows = (visits ?? []) as VisitRow[]

  return (
    <main className="min-h-dvh bg-neutral-50 text-neutral-950">
      <div className="mx-auto min-h-dvh w-full max-w-xl px-4 py-5 pb-28">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Daily Board</p>
            <h1 className="text-4xl font-black leading-none tracking-[-0.05em]">Today</h1>
          </div>
          <Link href="/invoices" className="flex min-h-12 items-center rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-black text-neutral-800">
            Billing
          </Link>
        </header>

        {(pageError || error) && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">
            {pageError ?? error?.message}
          </div>
        )}

        <section className="grid gap-3">
          {rows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-6 text-lg font-bold text-neutral-500">
              No visits scheduled for today.
            </div>
          ) : (
            rows.map(row => {
              const request = firstRelation(row.service_requests)
              const customer = firstRelation(request?.customers)
              const location = firstRelation(request?.locations)
              const tech = firstRelation(row.assigned_user)

              return (
                <Link
                  key={row.id}
                  href={`/visits/${row.id}/transit`}
                  className="block rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm active:scale-[0.99]"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-black leading-tight">{customer?.name ?? 'Unknown customer'}</div>
                      <div className="mt-1 text-base font-bold text-neutral-500">{location?.name ?? location?.street_address ?? 'Unknown address'}</div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(row.status)}`}>
                      {row.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-base font-semibold text-neutral-700">
                    {request?.problem_description ?? 'No problem description.'}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm font-black text-neutral-500">
                    <span>{crewName(tech)}</span>
                    <span>{row.queue_position ? `Stop ${row.queue_position}` : row.billing_status.replaceAll('_', ' ')}</span>
                  </div>
                </Link>
              )
            })
          )}
        </section>

        <Link
          href="/intake"
          aria-label="Fast Intake"
          className="fixed bottom-6 right-6 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-950 text-5xl font-black leading-none text-white shadow-2xl active:scale-95"
        >
          +
        </Link>
      </div>
    </main>
  )
}
