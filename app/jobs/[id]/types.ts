// Shared types for the tech job flow

export interface JobCustomer { id: string; name: string }
export interface JobLocation { id: string; name: string; access_notes: string | null }
export interface JobUnit { id: string; name: string; unit_type: string }
export interface ObservationCircuit {
  id: string
  circuit_number: 1 | 2
  suction_pressure: number | null
  suction_line_temp: number | null
  liquid_pressure: number | null
  liquid_line_temp: number | null
}
export interface ObservationCircuitState {
  id?: string | null
  circuit_number: 1 | 2
  suction_pressure: string
  suction_line_temp: string
  liquid_pressure: string
  liquid_line_temp: string
}
export interface ObservedComponentState {
  id?: string | null
  key: string
  label: string
  subtype: string
  make: string
  model: string
  serial_number: string
  tonnage: string
  refrigerant_type: string
  metering_device: string
  heating_capacity_btu: string
}
export interface JobSystem {
  id: string; name: string; system_type: string | null; system_subtype: string | null
  group_name: string | null; tonnage: number | null
  make: string | null; model: string | null; serial_number: string | null
  refrigerant_type: string | null; metering_device: string | null
  heating_capacity_btu: number | null
  notes: string | null
  served_areas: string | null; thermostat_location: string | null
  equipment_location: string | null; controls_notes: string | null
  manufacture_date: string | null; manufacture_date_source: string | null
}
export interface JobDiagnosis { id: string; repair_code: string; repair_notes: string | null }
export interface JobAdhocLine {
  id?: string | null
  quantity: number
  items: {
    id: string
    name: string
    type: string
    unit: string | null
    is_placeholder?: boolean
  } | null
}
export interface JobAdhocBundle {
  id: string
  tech_description: string
  reviewed_by_admin: boolean
  admin_action: string | null
  promoted_diagnosis_id: string | null
  job_adhoc_bundle_lines: JobAdhocLine[]
}

export interface Job {
  id: string; status: string; priority: string
  manual_unit: string | null; problem_description: string | null
  access_confirmation_needed: boolean; access_confirmed: boolean
  assigned_tech: string | null; actual_tech: string | null
  job_date: string; arrived_at: string | null; completed_at: string | null
  tstat_mode: string | null; tstat_fan: string | null; system_response: string | null
  temp_outdoor: number | null; temp_outdoor_auto: number | null
  temp_return: number | null; temp_supply: number | null
  arrival_notes: string | null; diagnosis_id: string | null
  needs_admin_review?: boolean; new_diagnosis_requested?: boolean
  system_id: string | null
  customers: JobCustomer | null
  locations: JobLocation | null
  units: JobUnit | null
  systems: JobSystem | null
  system_components?: JobSystem[]
  observation_circuits?: ObservationCircuit[]
  diagnoses: JobDiagnosis | null
  adhoc_bundle?: JobAdhocBundle | null
}

export interface DiagnosisItem {
  id: string; repair_code: string
  location: string | null; component: string | null; action: string | null
  cat1: string | null; cat2: string | null; cat3: string | null
  invoice_description: string | null; repair_notes: string | null
  one_shot: boolean; variable_pricing: boolean
}

export interface BundleLineItem {
  id: string; name: string; type: string; unit: string; is_placeholder: boolean
}
export interface BundleLine {
  id: string; quantity: number; items: BundleLineItem | null
}
export interface RepairBundle {
  id: string; diagnosis_id: string; name: string
  addon_eligible: boolean; addon_description: string | null
  notes: string | null
  repair_bundle_lines: BundleLine[]
}

export interface JobAddOn {
  id: string; type: 'bundle' | 'item'; quantity: number
  repair_bundles: { id: string; name: string } | null
  items: { id: string; name: string; unit: string } | null
}

export interface CatalogItem {
  id: string; name: string; type: string; unit: string; is_placeholder: boolean; unit_cost?: number | null
}

export interface HistoryJob {
  id: string; job_date: string; status: string; manual_unit: string | null
  diagnoses: { repair_code: string } | null
}
