import { redirect } from 'next/navigation'
import LeanShell, { BigButton, BigLink } from '@/app/components/LeanShell'
import { createClient } from '@/utils/supabase/server'
import { firstRelation, SupabaseRelation } from '@/utils/supabase/relations'
import { arriveOnSite, startTransit } from '@/app/lean-actions'

type Visit = {
  id: string
  status: 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'cancelled'
  service_requests: SupabaseRelation<{
    problem_description: string | null
    locations: SupabaseRelation<{ name: string; street_address: string | null; city: string | null; state: string | null }>
  }>
}

export default async function TransitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('service_visits')
    .select(`
      id,
      status,
      service_requests!service_visits_service_request_id_fkey(
        problem_description,
        locations!service_requests_location_id_fkey(name, street_address, city, state)
      )
    `)
    .eq('id', id)
    .single()

  if (!data) redirect('/')
  const visit = data as Visit
  const request = firstRelation(visit.service_requests)
  const location = firstRelation(request?.locations)
  const address = [location?.street_address ?? location?.name, location?.city, location?.state].filter(Boolean).join(', ')
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  return (
    <LeanShell title="Go to site" eyebrow="Step 1 of 3" backHref="/">
      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">{error}</div>}
      <section className="grid flex-1 content-center gap-5">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-neutral-500">Destination</p>
          <p className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em]">{address || 'No address recorded'}</p>
        </div>

        <BigLink href={mapsUrl} tone="plain">Open Maps</BigLink>

        {visit.status === 'scheduled' && (
          <form action={startTransit.bind(null, visit.id)}>
            <BigButton type="submit" tone="gold">Start Route</BigButton>
          </form>
        )}

        <form action={arriveOnSite.bind(null, visit.id)}>
          <BigButton type="submit" tone="green">Arrived on Site</BigButton>
        </form>
      </section>
    </LeanShell>
  )
}
