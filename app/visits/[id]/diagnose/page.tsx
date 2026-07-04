import { redirect } from 'next/navigation'
import LeanShell, { BigButton, FieldLabel, TextArea } from '@/app/components/LeanShell'
import { createClient } from '@/utils/supabase/server'
import { firstRelation, SupabaseRelation } from '@/utils/supabase/relations'
import { saveDiagnosisNote } from '@/app/lean-actions'

type Visit = {
  id: string
  service_requests: SupabaseRelation<{ problem_description: string | null }>
}

export default async function DiagnosePage({
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
    .select('id, service_requests!service_visits_service_request_id_fkey(problem_description)')
    .eq('id', id)
    .single()

  if (!data) redirect('/')
  const visit = data as Visit
  const request = firstRelation(visit.service_requests)

  return (
    <LeanShell title="Diagnose" eyebrow="Step 2 of 3" backHref={`/visits/${id}/transit`}>
      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">{error}</div>}
      <div className="mb-5 rounded-3xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-neutral-500">Customer said</p>
        <p className="mt-3 text-xl font-black leading-snug">{request?.problem_description ?? 'No problem description recorded.'}</p>
      </div>

      <form action={saveDiagnosisNote} className="grid gap-5">
        <input type="hidden" name="visit_id" value={id} />
        <div>
          <FieldLabel>Visit notes</FieldLabel>
          <TextArea name="body" required placeholder="Access, diagnosis, work performed, readings..." />
        </div>
        <BigButton type="submit" tone="dark">Finish Work</BigButton>
      </form>
    </LeanShell>
  )
}
