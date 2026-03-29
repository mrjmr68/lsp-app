import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import CustomersList from './CustomersList'
import { createCustomer } from './actions'

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, type, parent_id, locations(id)')
    .order('name')

  if (error) console.error('Customers query error:', error.message)

  return (
    <AppShell>
      <CustomersList
        customers={(customers ?? []) as any}
        createCustomerAction={createCustomer}
      />
    </AppShell>
  )
}
