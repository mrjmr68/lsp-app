import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import UnitDetail from './UnitDetail'
import { updateUnit, createSystem, updateSystemFromCustomers } from '../../../actions'

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ customerId: string; locationId: string; unitId: string }>
}) {
  const { customerId, locationId, unitId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: unit, error } = await supabase
    .from('units')
    .select(`
      id, name, unit_type, notes,
      locations!units_location_id_fkey(
        id, name, customer_id,
        customers!locations_customer_id_fkey(id, name, type)
      ),
      systems(
        id, name, system_type, system_subtype, group_name,
        tonnage, make, model, serial_number,
        refrigerant_type, metering_device, notes,
        served_areas, thermostat_location, equipment_location,
        controls_notes, manufacture_date, manufacture_date_source
      )
    `)
    .eq('id', unitId)
    .single()

  if (error || !unit) redirect(`/customers/${customerId}/${locationId}`)

  return (
    <AppShell>
      <UnitDetail
        unit={unit as any}
        customerId={customerId}
        locationId={locationId}
        updateUnitAction={updateUnit}
        createSystemAction={createSystem}
        updateSystemAction={updateSystemFromCustomers}
      />
    </AppShell>
  )
}
