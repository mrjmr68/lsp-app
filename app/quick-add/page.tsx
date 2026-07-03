import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import { createClient } from '@/utils/supabase/server'
import { addJob } from '@/app/planning/actions'
import QuickAddForm, { QuickAddCustomer, QuickAddLocation, QuickAddTech } from './QuickAddForm'

export default async function QuickAddPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: customers }, { data: locations }, { data: techs, error: techsError }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, type')
      .order('name'),
    supabase
      .from('locations')
      .select('id, name, customer_id')
      .order('name'),
    supabase
      .rpc('list_assignable_users'),
  ])

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
            Quick Add Job
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: 32, lineHeight: 1.05, color: '#202329' }}>
            Capture the call before it gets away.
          </h1>
          <p style={{ margin: '9px 0 0', maxWidth: 620, color: '#5d584f', lineHeight: 1.5 }}>
            Create the service request, first visit, and planning job together. Assign now if you know the tech, or leave it unassigned for dispatch.
          </p>
        </header>

        {techsError && (
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
            Assignable techs could not load: {techsError.message}
          </div>
        )}

        <section style={{
          border: '1px solid #d7d0c1',
          borderRadius: 8,
          background: 'rgba(255, 253, 248, 0.76)',
          padding: 16,
          boxShadow: '0 10px 22px rgba(43, 46, 52, 0.06)',
        }}>
          <QuickAddForm
            customers={(customers ?? []) as QuickAddCustomer[]}
            locations={(locations ?? []) as QuickAddLocation[]}
            techs={(techs ?? []) as QuickAddTech[]}
            addJobAction={addJob}
          />
        </section>
      </div>
    </AppShell>
  )
}
