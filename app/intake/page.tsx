import { redirect } from 'next/navigation'
import LeanShell, { FieldLabel, SelectInput, TextArea, TextInput } from '@/app/components/LeanShell'
import { createClient } from '@/utils/supabase/server'
import { createFastIntake } from '@/app/lean-actions'

type CrewMember = {
  id: string
  first_name: string
  last_name: string
}

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: crew } = await supabase.rpc('list_assignable_users')

  return (
    <LeanShell title="Fast Intake" eyebrow="New call" backHref="/">
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">
          {error}
        </div>
      )}

      <form action={createFastIntake} className="grid gap-5">
        <div>
          <FieldLabel>Customer name</FieldLabel>
          <TextInput name="customer_name" autoComplete="name" required placeholder="Jane Smith" />
        </div>

        <div>
          <FieldLabel>Address</FieldLabel>
          <TextInput name="address" autoComplete="street-address" required placeholder="123 Elm St" />
        </div>

        <div>
          <FieldLabel>Phone</FieldLabel>
          <TextInput name="phone" type="tel" autoComplete="tel" placeholder="336-555-1212" />
        </div>

        <div>
          <FieldLabel>Problem description</FieldLabel>
          <TextArea name="problem_description" required placeholder="No cooling, water around unit, strange noise..." />
        </div>

        <div>
          <FieldLabel>Assign now</FieldLabel>
          <SelectInput name="assigned_tech" defaultValue="">
            <option value="">Assign later</option>
            {((crew ?? []) as CrewMember[]).map(member => (
              <option key={member.id} value={member.id}>
                {member.first_name} {member.last_name}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="grid gap-3 pt-2">
          <button
            type="submit"
            name="intent"
            value="assign_later"
            className="min-h-16 w-full rounded-2xl border border-neutral-300 bg-white px-5 text-left text-lg font-black text-neutral-950 shadow-sm active:scale-[0.99]"
          >
            Save & Assign Later
          </button>
          <button
            type="submit"
            name="intent"
            value="assign_now"
            className="min-h-16 w-full rounded-2xl border border-neutral-950 bg-neutral-950 px-5 text-left text-lg font-black text-white shadow-sm active:scale-[0.99]"
          >
            Save & Assign Now
          </button>
        </div>
      </form>
    </LeanShell>
  )
}
