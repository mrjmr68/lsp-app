import { redirect } from 'next/navigation'
import LeanShell, { BigButton, FieldLabel, SelectInput } from '@/app/components/LeanShell'
import { createClient } from '@/utils/supabase/server'
import { selectLeanRepair, completeRepairVisit } from '@/app/lean-actions'

type RepairBundle = {
  id: string
  name: string
  flat_rate: number | null
  variable_pricing: boolean | null
  diagnoses: { repair_code: string | null }[] | { repair_code: string | null } | null
}

function firstDiagnosis(value: RepairBundle['diagnoses']) {
  return Array.isArray(value) ? value[0] ?? null : value
}

export default async function RepairsPage({
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

  const [{ data: bundles }, { data: repairs }] = await Promise.all([
    supabase
      .from('repair_bundles')
      .select('id, name, flat_rate, variable_pricing, diagnoses!repair_bundles_diagnosis_id_fkey(repair_code)')
      .order('name')
      .limit(250),
    supabase
      .from('visit_repairs')
      .select('id, repair_code, description_title, flat_rate_amount')
      .eq('service_visit_id', id)
      .order('selected_at', { ascending: false }),
  ])

  return (
    <LeanShell title="Select repairs" eyebrow="Resolution" backHref={`/visits/${id}/resolve`}>
      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">{error}</div>}
      <form action={selectLeanRepair} className="mb-5 grid gap-4">
        <input type="hidden" name="visit_id" value={id} />
        <div>
          <FieldLabel>Repair catalog</FieldLabel>
          <SelectInput name="repair_bundle_id" required defaultValue="">
            <option value="">Choose repair</option>
            {((bundles ?? []) as RepairBundle[]).map(bundle => {
              const diagnosis = firstDiagnosis(bundle.diagnoses)
              return (
                <option key={bundle.id} value={bundle.id}>
                  {diagnosis?.repair_code ? `${diagnosis.repair_code} - ` : ''}{bundle.name}
                </option>
              )
            })}
          </SelectInput>
        </div>
        <BigButton type="submit" tone="green">Add Selected Repair</BigButton>
      </form>

      <div className="mb-5 grid gap-2">
        {(repairs ?? []).map(repair => (
          <div key={repair.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-base font-black">{repair.repair_code ?? repair.description_title}</div>
            <div className="mt-1 text-sm font-bold text-neutral-500">
              {repair.flat_rate_amount ? `$${repair.flat_rate_amount}` : 'Price review needed'}
            </div>
          </div>
        ))}
      </div>

      <form action={completeRepairVisit.bind(null, id)}>
        <BigButton type="submit" tone="dark">Complete for Billing</BigButton>
      </form>
    </LeanShell>
  )
}
