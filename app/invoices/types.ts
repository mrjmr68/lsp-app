// ── Invoice queue list ────────────────────────────────────────────────────────

import { JobCommercialState, JobResolutionType, JobStatus } from '@/utils/job-lifecycle'

export interface InvoiceQueueJob {
  id: string
  job_status: JobStatus
  resolution_type: JobResolutionType | null
  commercial_state: JobCommercialState
  status: string
  priority: string
  manual_unit: string | null
  job_date: string
  completed_at: string | null
  needs_admin_review: boolean
  flagged_for_review: boolean
  diagnosis_id: string | null
  customers: { id: string; name: string } | null
  locations: { id: string; name: string } | null
  units: { id: string; name: string } | null
  diagnoses: { id: string; repair_code: string } | null
  users: { id: string; first_name: string; last_name: string } | null
  job_estimates?: InvoiceEstimateRecord[] | InvoiceEstimateRecord | null
}

// ── Invoice detail ───────────────────────────────────────────────────────────

export interface InvoiceJob {
  id: string
  job_status: JobStatus
  resolution_type: JobResolutionType | null
  commercial_state: JobCommercialState
  status: string
  priority: string
  manual_unit: string | null
  problem_description: string | null
  job_date: string
  arrived_at: string | null
  completed_at: string | null
  how_it_came_in: string | null
  tstat_mode: string | null
  tstat_fan: string | null
  system_response: string | null
  temp_outdoor: number | null
  temp_return: number | null
  temp_supply: number | null
  arrival_notes: string | null
  diagnosis_id: string | null
  needs_admin_review: boolean
  flagged_for_review: boolean
  admin_notes: string | null
  flat_rate_override: number | null
  invoice_number: string | null
  invoice_pdf_path: string | null
  invoice_subtotal: number | null
  invoice_tax: number | null
  invoice_total: number | null
  approved_at: string | null
  approved_by: string | null
  customer_id: string | null
  location_id: string | null
  customers: InvoiceCustomer | null
  locations: InvoiceLocation | null
  units: { id: string; name: string; unit_type: string } | null
  systems: InvoiceSystem | null
  diagnoses: InvoiceDiagnosis | null
  users: { id: string; first_name: string; last_name: string } | null
  job_estimates?: InvoiceEstimateRecord[] | InvoiceEstimateRecord | null
  job_parts_requests?: InvoicePartsRequest[] | InvoicePartsRequest | null
  new_diagnosis_requested?: boolean
}

export interface InvoiceEstimateRecord {
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
  generated_at: string | null
  sent_at: string | null
  approved_at: string | null
}

export interface InvoicePartsRequestLine {
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

export interface InvoicePartsRequest {
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
  job_parts_request_lines: InvoicePartsRequestLine[]
}

export interface InvoiceCustomer {
  id: string
  name: string
  type: string | null
  billing_email: string | null
  bill_to_parent: boolean
  parent_id: string | null
}

export interface InvoiceLocation {
  id: string
  name: string
  tax_rate: number | null
}

export interface InvoiceSystem {
  id: string
  name: string
  system_subtype: string | null
  group_name: string | null
  tonnage: number | null
  make: string | null
  model: string | null
  refrigerant_type: string | null
  metering_device: string | null
}

export interface InvoiceDiagnosis {
  id: string
  repair_code: string
  invoice_description: string | null
  repair_notes: string | null
  variable_pricing: boolean
}

// ── Repair bundle with pricing (admin-only) ──────────────────────────────────

export interface InvoiceBundleLine {
  id: string
  quantity: number
  cost_at_build: number
  items: {
    id: string
    name: string
    type: string
    unit: string
    unit_cost: number
    is_placeholder: boolean
  } | null
}

export interface InvoiceRepairBundle {
  id: string
  diagnosis_id: string
  name: string
  flat_rate: number
  repair_notes: string | null
  repair_bundle_lines: InvoiceBundleLine[]
}

export interface InvoiceAdhocBundle {
  id: string
  tech_description: string
  reviewed_by_admin: boolean
  admin_action: string | null
  promoted_diagnosis_id: string | null
  job_adhoc_bundle_lines: InvoiceBundleLine[]
}

// ── Add-ons with pricing ─────────────────────────────────────────────────────

export interface InvoiceAddOn {
  id: string
  type: 'bundle' | 'item'
  quantity: number
  repair_bundles: { id: string; name: string; flat_rate: number } | null
  items: { id: string; name: string; unit: string; unit_cost: number } | null
}

// ── Placeholder costs ────────────────────────────────────────────────────────

export interface PlaceholderCost {
  id: string
  item_id: string
  actual_cost: number | null
}

// ── Parent customer for bill-to ──────────────────────────────────────────────

export interface ParentCustomer {
  id: string
  name: string
  billing_email: string | null
}

// ── Variance data ────────────────────────────────────────────────────────────

export interface VarianceData {
  count: number
  avg: number
  min: number
  max: number
}

// ── Photo counts ─────────────────────────────────────────────────────────────

export interface PhotoCounts {
  arrival: number
  fault: number
  post_repair: number
}

// ── App config ───────────────────────────────────────────────────────────────

export interface AppConfig {
  labor_cost_per_hour: number
  travel_time_hours: number
  refrigerant_cost_per_lb: number
  profit_per_hour_target: number
}
