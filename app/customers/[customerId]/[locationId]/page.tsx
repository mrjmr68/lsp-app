import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import LocationDetail from './LocationDetail'
import { updateLocation, createSystemForLocation, createUnitWithSystem, updateSystemFromCustomers } from '../../actions'

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ customerId: string; locationId: string }>
}) {
  const { customerId, locationId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: location, error } = await supabase
    .from('locations')
    .select(`
      id, name, street_address, city, state, zip, access_notes, tax_rate, customer_id,
      customers!locations_customer_id_fkey(id, name, type),
      units(id, name, unit_type, systems(
        id, name, system_type, system_subtype, group_name,
        tonnage, make, model, serial_number,
        refrigerant_type, metering_device, notes,
        served_areas, thermostat_location, equipment_location,
        controls_notes, manufacture_date, manufacture_date_source
      ))
    `)
    .eq('id', locationId)
    .single()

  if (error || !location) redirect(`/customers/${customerId}`)

  const customerType = (location as any).customers?.type ?? null
  const flat = customerType === 'commercial' || customerType === 'facilities_provider'

  // For flat (commercial): flatten systems from all hidden units
  let flatSystems: any[] = []
  if (flat) {
    flatSystems = ((location as any).units ?? []).flatMap((u: any) =>
      (u.systems ?? []).map((s: any) => ({ ...s, _unitId: u.id }))
    )
  }

  return (
    <AppShell>
      <LocationDetail
        location={location as any}
        customerId={customerId}
        customerType={customerType}
        flatSystems={flat ? flatSystems : undefined}
        updateLocationAction={updateLocation}
        createSystemForLocationAction={createSystemForLocation}
        createUnitWithSystemAction={createUnitWithSystem}
        updateSystemAction={updateSystemFromCustomers}
      />
    </AppShell>
  )
}
