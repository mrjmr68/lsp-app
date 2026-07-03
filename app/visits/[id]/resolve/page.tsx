import { redirect } from 'next/navigation'
import LeanShell, { BigButton, BigLink } from '@/app/components/LeanShell'
import { createClient } from '@/utils/supabase/server'
import { closeNoAction } from '@/app/lean-actions'

export default async function ResolvePage({
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

  return (
    <LeanShell title="How did it end?" eyebrow="Step 3 of 3" backHref={`/visits/${id}/diagnose`}>
      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">{error}</div>}
      <section className="grid flex-1 content-center gap-4">
        <BigLink href={`/visits/${id}/repairs`} tone="green">Add Repairs</BigLink>
        <BigLink href={`/visits/${id}/parts`} tone="gold">Order Parts</BigLink>
        <form action={closeNoAction.bind(null, id)}>
          <BigButton type="submit" tone="plain">Close - No Action</BigButton>
        </form>
      </section>
    </LeanShell>
  )
}
