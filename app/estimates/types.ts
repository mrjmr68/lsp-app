import { JobCommercialState, JobResolutionType, JobStatus } from '@/utils/job-lifecycle'

export interface EstimateRecord {
  id: string
  estimate_number: string | null
  status: 'draft' | 'sent' | 'approved' | 'declined'
  customer_summary: string | null
  scope_of_work: string | null
  line_items: Array<{ label: string; amount: number }>
  subtotal: number
  tax_rate: number
  tax: number
  total: number
  send_to_email: string | null
  cc_email: string | null
  pdf_path: string | null
  generated_at: string | null
  sent_at: string | null
  approved_at: string | null
}

export interface PartsRequestLine {
  id: string
  item_id: string | null
  part_name: string
  part_number: string | null
  quantity: number
  unit_cost: number | null
  notes: string | null
  ordered: boolean
  sort_order: number
}

export interface PartsRequest {
  id: string
  vendor_name: string | null
  vendor_email: string | null
  eta_date: string | null
  vendor_notes: string | null
  email_subject: string | null
  email_body: string | null
  vendor_email_sent_at: string | null
  ordered_at: string | null
  ready_to_schedule_at: string | null
  job_parts_request_lines: PartsRequestLine[]
}

export interface EstimateQueueJob {
  id: string
  job_status: JobStatus
  resolution_type: JobResolutionType | null
  commercial_state: JobCommercialState
  status: string
  manual_unit: string | null
  completed_at: string | null
  needs_admin_review: boolean
  customers: { id: string; name: string } | null
  locations: { id: string; name: string } | null
  units: { id: string; name: string } | null
  diagnoses: { id: string; repair_code: string } | null
  users: { id: string; first_name: string; last_name: string } | null
  job_estimates?: EstimateRecord[] | EstimateRecord | null
  job_parts_requests?: PartsRequest[] | PartsRequest | null
}

export interface EstimateJob {
  id: string
  job_status: JobStatus
  resolution_type: JobResolutionType | null
  commercial_state: JobCommercialState
  status: string
  assigned_tech: string | null
  manual_unit: string | null
  problem_description: string | null
  job_date: string
  completed_at: string | null
  customer_id: string | null
  location_id: string | null
  diagnosis_id: string | null
  flat_rate_override: number | null
  admin_notes: string | null
  customers: EstimateCustomer | null
  locations: EstimateLocation | null
  units: { id: string; name: string; unit_type: string } | null
  systems: EstimateSystem | null
  diagnoses: EstimateDiagnosis | null
  users: { id: string; first_name: string; last_name: string } | null
  job_parts_requests?: PartsRequest[] | PartsRequest | null
}

export interface EstimateCustomer {
  id: string
  name: string
  billing_email: string | null
  bill_to_parent: boolean
  parent_id: string | null
}

export interface EstimateLocation {
  id: string
  name: string
  tax_rate: number | null
}

export interface EstimateSystem {
  id: string
  name: string
  system_subtype: string | null
  group_name: string | null
  make: string | null
  refrigerant_type: string | null
  metering_device: string | null
}

export interface EstimateDiagnosis {
  id: string
  repair_code: string
  invoice_description: string | null
  repair_notes: string | null
}

export interface EstimateBundleLine {
  id: string
  quantity: number
  cost_at_build: number
  items: {
    id: string
    name: string
    unit_cost: number
  } | null
}

export interface EstimateRepairBundle {
  id: string
  diagnosis_id: string
  name: string
  flat_rate: number
  repair_notes: string | null
  repair_bundle_lines: EstimateBundleLine[]
}

export interface EstimateAdhocBundle {
  id: string
  tech_description: string
}

export interface EstimateAddOn {
  id: string
  type: 'bundle' | 'item'
  quantity: number
  repair_bundles: { id: string; name: string; flat_rate: number } | null
  items: { id: string; name: string; unit: string; unit_cost: number } | null
}

export interface ParentCustomer {
  id: string
  name: string
  billing_email: string | null
}

export interface EstimateTech {
  id: string
  first_name: string
  last_name: string
  role: string
}
