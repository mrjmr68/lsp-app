import Link from 'next/link'
import { redirect } from 'next/navigation'
import LeanShell from '@/app/components/LeanShell'
import { createClient } from '@/utils/supabase/server'
import { firstRelation, SupabaseRelation } from '@/utils/supabase/relations'

type BillingVisit = {
  id: string
  completed_at: string | null
  legacy_job_id: string | null
  service_requests: SupabaseRelation<{
    customers: SupabaseRelation<{ name: string }>
    locations: SupabaseRelation<{ name: string }>
  }>
  visit_repairs: Array<{
    repair_code: string | null
    description_title: string
    flat_rate_amount: number | null
  }>
}

function money(value: number) {
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default async function BillingQueue() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: visits, error } = await supabase
    .from('service_visits')
    .select(`
      id,
      completed_at,
      legacy_job_id,
      service_requests!service_visits_service_request_id_fkey(
        customers!service_requests_customer_id_fkey(name),
        locations!service_requests_location_id_fkey(name)
      ),
      visit_repairs(repair_code, description_title, flat_rate_amount)
    `)
    .eq('billing_status', 'ready_for_invoice')
    .order('completed_at', { ascending: true })

  const rows = (visits ?? []) as BillingVisit[]

  return (
    <LeanShell title="Billing Queue" eyebrow="End of day" backHref="/">
      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">{error.message}</div>}
      <section className="grid gap-3">
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-6 text-lg font-bold text-neutral-500">
            No visits ready for invoice.
          </div>
        ) : (
          rows.map(visit => {
            const request = firstRelation(visit.service_requests)
            const customer = firstRelation(request?.customers)
            const location = firstRelation(request?.locations)
            const total = visit.visit_repairs.reduce((sum, repair) => sum + (repair.flat_rate_amount ?? 0), 0)

            return (
              <Link key={visit.id} href={`/invoices/${visit.id}`} className="block rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm active:scale-[0.99]">
                <div className="text-xl font-black">{customer?.name ?? 'Unknown customer'}</div>
                <div className="mt-1 text-base font-bold text-neutral-500">{location?.name ?? 'Unknown location'}</div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm font-black text-neutral-500">
                  <span>{visit.visit_repairs.length} repair{visit.visit_repairs.length === 1 ? '' : 's'}</span>
                  <span>{total > 0 ? money(total) : 'Price review'}</span>
                </div>
              </Link>
            )
          })
        )}
      </section>
    </LeanShell>
  )
}
