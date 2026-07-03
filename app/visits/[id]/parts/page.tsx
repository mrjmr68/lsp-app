import { redirect } from 'next/navigation'
import LeanShell, { BigButton, FieldLabel, TextArea, TextInput } from '@/app/components/LeanShell'
import { createClient } from '@/utils/supabase/server'
import { markLeanPartsNeeded } from '@/app/lean-actions'

export default async function PartsPage({
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
    <LeanShell title="Order Parts" eyebrow="Parts needed" backHref={`/visits/${id}/resolve`}>
      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">{error}</div>}
      <form action={markLeanPartsNeeded} className="grid gap-5">
        <input type="hidden" name="visit_id" value={id} />
        <div>
          <FieldLabel>Part needed</FieldLabel>
          <TextInput name="part_name" required placeholder="Blower motor, capacitor, board..." />
        </div>
        <div>
          <FieldLabel>Quantity</FieldLabel>
          <TextInput name="quantity" type="number" min="1" step="1" defaultValue="1" />
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <TextArea name="notes" placeholder="Model, serial, measurements, vendor, urgency..." />
        </div>
        <BigButton type="submit" tone="gold">Mark Parts Needed</BigButton>
      </form>
    </LeanShell>
  )
}
