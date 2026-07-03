import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import LeanShell from '@/app/components/LeanShell'
import { BigButton, FieldLabel, TextInput } from '@/app/components/LeanShell'
import { createClient } from '@/utils/supabase/server'
import { firstRelation, SupabaseRelation } from '@/utils/supabase/relations'
import { approveInvoice, saveFlatRateOverride } from './actions'

type InvoiceVisit = {
  id: string
  legacy_job_id: string | null
  service_requests: SupabaseRelation<{
    customers: SupabaseRelation<{ name: string; billing_email: string | null }>
    locations: SupabaseRelation<{ name: string }>
  }>
  visit_repairs: Array<{
    id: string
    repair_code: string | null
    description_title: string
    customer_description: string | null
    flat_rate_amount: number | null
    variable_pricing: boolean
  }>
}

function money(value: number) {
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default async function InvoiceReview({
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
      legacy_job_id,
      service_requests!service_visits_service_request_id_fkey(
        customers!service_requests_customer_id_fkey(name, billing_email),
        locations!service_requests_location_id_fkey(name)
      ),
      visit_repairs(id, repair_code, description_title, customer_description, flat_rate_amount, variable_pricing)
    `)
    .eq('id', id)
    .single()

  if (!data) redirect('/invoices')
  const visit = data as InvoiceVisit
  const request = firstRelation(visit.service_requests)
  const customer = firstRelation(request?.customers)
  const location = firstRelation(request?.locations)
  const needsOverride = visit.visit_repairs.some(repair => repair.variable_pricing || (repair.flat_rate_amount ?? 0) <= 0)
  const total = visit.visit_repairs.reduce((sum, repair) => sum + (repair.flat_rate_amount ?? 0), 0)

  async function approveVisitInvoice(formData: FormData) {
    'use server'

    const visitId = formData.get('visit_id')?.toString()
    const jobId = formData.get('legacy_job_id')?.toString()
    const overrideText = formData.get('flat_rate_override')?.toString().trim()
    const sendToEmail = formData.get('send_to_email')?.toString().trim() ?? ''

    if (!visitId || !jobId) redirect('/invoices?error=Missing invoice target.')

    const parsedOverride = overrideText ? Number(overrideText) : null
    if (parsedOverride !== null && (!Number.isFinite(parsedOverride) || parsedOverride <= 0)) {
      redirect(`/invoices/${visitId}?error=${encodeURIComponent('Enter a valid price override.')}`)
    }

    if (parsedOverride != null) {
      const saveResult = await saveFlatRateOverride(jobId, parsedOverride)
      if (saveResult.error) redirect(`/invoices/${visitId}?error=${encodeURIComponent(saveResult.error)}`)
    }

    const result = await approveInvoice(jobId, { sendToEmail, ccEmail: '' })
    if (result.error) redirect(`/invoices/${visitId}?error=${encodeURIComponent(result.error)}`)

    revalidatePath('/invoices')
    revalidatePath('/')
    redirect('/invoices')
  }

  return (
    <LeanShell title="Approve bill" eyebrow="Invoice review" backHref="/invoices">
      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-base font-bold text-red-800">{error}</div>}
      <section className="mb-5 rounded-3xl border border-neutral-200 bg-white p-5">
        <div className="text-2xl font-black">{customer?.name ?? 'Unknown customer'}</div>
        <div className="mt-1 text-base font-bold text-neutral-500">{location?.name ?? 'Unknown location'}</div>
      </section>

      <section className="mb-5 grid gap-3">
        {visit.visit_repairs.map(repair => (
          <div key={repair.id} className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-black">{repair.repair_code ?? repair.description_title}</div>
                <p className="mt-2 text-base font-semibold text-neutral-600">{repair.customer_description ?? repair.description_title}</p>
              </div>
              <div className="text-lg font-black">{repair.flat_rate_amount ? money(repair.flat_rate_amount) : 'Review'}</div>
            </div>
            {repair.variable_pricing && <div className="mt-3 rounded-2xl bg-amber-100 px-4 py-2 text-sm font-black text-amber-800">Variable price</div>}
          </div>
        ))}
      </section>

      <form action={approveVisitInvoice} className="grid gap-5">
        <input type="hidden" name="visit_id" value={visit.id} />
        <input type="hidden" name="legacy_job_id" value={visit.legacy_job_id ?? ''} />

        <div>
          <FieldLabel>Send to</FieldLabel>
          <TextInput name="send_to_email" type="email" defaultValue={customer?.billing_email ?? ''} required placeholder="billing@example.com" />
        </div>

        {needsOverride && (
          <div>
            <FieldLabel>Price override</FieldLabel>
            <TextInput name="flat_rate_override" inputMode="decimal" placeholder="0.00" required />
          </div>
        )}

        {!needsOverride && (
          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="text-sm font-black uppercase tracking-[0.14em] text-neutral-500">Total</div>
            <div className="mt-2 text-4xl font-black tracking-[-0.05em]">{money(total)}</div>
          </div>
        )}

        <BigButton type="submit" tone="green">Approve & Send</BigButton>
      </form>
    </LeanShell>
  )
}
