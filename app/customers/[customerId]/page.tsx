import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import CustomerDetail from './CustomerDetail'
import { updateCustomer, createLocation } from '../actions'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customer, error } = await supabase
    .from('customers')
    .select(`
      id, name, type, billing_address, billing_email, billing_phone, bill_to_parent, notes, parent_id,
      locations(id, name, street_address, city, state, units(id, systems(id)))
    `)
    .eq('id', customerId)
    .single()

  if (error || !customer) redirect('/customers')

  // Fetch parent name if applicable
  let parentName: string | null = null
  let parentId: string | null = null
  if ((customer as any).parent_id) {
    parentId = (customer as any).parent_id
    const { data: parent } = await supabase
      .from('customers')
      .select('name')
      .eq('id', parentId!)
      .single()
    parentName = parent?.name ?? null
  }

  // Fetch all customers for parent dropdown in inline editing
  const { data: allCustomers } = await supabase
    .from('customers')
    .select('id, name')
    .order('name')

  return (
    <AppShell>
      <CustomerDetail
        customer={customer as any}
        parentName={parentName}
        parentId={parentId}
        allCustomers={(allCustomers ?? []) as any}
        updateCustomerAction={updateCustomer}
        createLocationAction={createLocation}
      />
    </AppShell>
  )
}
