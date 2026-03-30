// Shared types for the tech job flow

import { JobCommercialState, JobResolutionType, JobStatus } from '@/utils/job-lifecycle'

export interface JobCustomer { id: string; name: string }
export interface JobLocation { id: string; name: string; access_notes: string | null }
export interface JobUnit { id: string; name: string; unit_type: string }
export interface JobCrewMember {
  id: string
  first_name: string
  last_name: string
  role: string
  assignment_role: 'assigned' | 'actual' | 'primary' | 'assist'
}

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
  id: string
  name: string
  system_type: string | null
  system_subtype: string | null
  group_name: string | null
  tonnage: number | null
  make: string | null
  model: string | null
  serial_number: string | null
  refrigerant_type: string | null
  metering_device: string | null
  heating_capacity_btu: number | null
  notes: string | null
  served_areas: string | null
  thermostat_location: string | null
  equipment_location: string | null
  controls_notes: string | null
  manufacture_date: string | null
  manufacture_date_source: string | null
}

export interface JobDiagnosis {
  id: string
  repair_code: string
  repair_notes: string | null
}

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
  id: string
  job_status: JobStatus
  resolution_type: JobResolutionType | null
  commercial_state: JobCommercialState
  status: string
  priority: string
  manual_unit: string | null
  problem_description: string | null
  access_confirmation_needed: boolean
  access_confirmed: boolean
  assigned_tech: string | null
  actual_tech: string | null
  job_date: string
  arrived_at: string | null
  completed_at: string | null
  tstat_mode: string | null
  tstat_fan: string | null
  system_response: string | null
  temp_outdoor: number | null
  temp_outdoor_auto: number | null
  temp_return: number | null
  temp_supply: number | null
  arrival_notes: string | null
  diagnosis_id: string | null
  needs_admin_review?: boolean
  new_diagnosis_requested?: boolean
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
  id: string
  repair_code: string
  location: string | null
  component: string | null
  action: string | null
  cat1: string | null
  cat2: string | null
  cat3: string | null
  invoice_description: string | null
  repair_notes: string | null
  one_shot: boolean
  variable_pricing: boolean
}

export interface BundleLineItem {
  id: string
  name: string
  type: string
  unit: string
  is_placeholder: boolean
}

export interface BundleLine {
  id: string
  quantity: number
  items: BundleLineItem | null
}

export interface RepairBundle {
  id: string
  diagnosis_id: string
  name: string
  addon_eligible: boolean
  addon_description: string | null
  notes: string | null
  repair_bundle_lines: BundleLine[]
}

export interface JobAddOn {
  id: string
  type: 'bundle' | 'item'
  quantity: number
  repair_bundles: { id: string; name: string } | null
  items: { id: string; name: string; unit: string } | null
}

export interface CatalogItem {
  id: string
  name: string
  type: string
  unit: string
  is_placeholder: boolean
  unit_cost?: number | null
}

export interface HistoryJob {
  id: string
  job_date: string
  job_status: JobStatus
  resolution_type: JobResolutionType | null
  commercial_state: JobCommercialState
  status: string
  manual_unit: string | null
  diagnoses: { repair_code: string } | null
}

export interface JobWorkflowItem {
  id: string
  phase: 'prep' | 'materials' | 'execution' | 'closeout'
  sort_order: number
  label: string
  details: string | null
  action_key: string | null
  required: boolean
  completed: boolean
  completed_at: string | null
  completed_by: string | null
  note: string | null
}

export interface JobWorkflow {
  id: string
  workflow_type: 'install' | 'major_repair'
  status: 'prep' | 'on_site' | 'closeout' | 'complete'
  started_at: string
  completed_at: string | null
  job_workflow_items: JobWorkflowItem[]
}

export type JobRelayActor = 'field_outside' | 'field_inside' | 'shared'
export type JobRelayKind = 'step' | 'branch'
export type JobRelayStepKey =
  | 'recovery_complete'
  | 'ready_to_purge'
  | 'ok_to_purge'
  | 'ready_to_braze'
  | 'nitrogen_flowing'
  | 'ready_to_test'
  | 'test_on'
  | 'leak_here'
  | 'test_holding'
  | 'vac_pulling'
  | 'vac_good'

export type RelayTransitionState =
  | 'idle'
  | 'active'
  | 'available'
  | 'complete'

export interface JobRelayStepDefinition {
  key: JobRelayStepKey
  sequence: number
  label: string
  shortLabel: string
  actor: JobRelayActor
  kind: JobRelayKind
  prompt: string
  nextStepKeys: JobRelayStepKey[]
}

export interface JobRelayStatus {
  activeStepKeys: JobRelayStepKey[]
  cycle: number
  completed: boolean
}

export interface JobRelayEvent {
  step: JobRelayStepDefinition
  cycle: number
}

const executionRelaySteps: JobRelayStepDefinition[] = [
  {
    key: 'recovery_complete',
    sequence: 10,
    label: 'Recovery complete',
    shortLabel: 'Recovery Complete',
    actor: 'field_outside',
    kind: 'step',
    prompt: 'Outside team confirms recovery is complete.',
    nextStepKeys: ['ready_to_purge'],
  },
  {
    key: 'ready_to_purge',
    sequence: 20,
    label: 'Ready to purge',
    shortLabel: 'Ready to Purge',
    actor: 'field_inside',
    kind: 'step',
    prompt: 'Inside team is ready for purge clearance.',
    nextStepKeys: ['ok_to_purge'],
  },
  {
    key: 'ok_to_purge',
    sequence: 30,
    label: 'OK to purge',
    shortLabel: 'OK to Purge',
    actor: 'field_outside',
    kind: 'step',
    prompt: 'Outside team clears the inside crew to purge.',
    nextStepKeys: ['ready_to_braze'],
  },
  {
    key: 'ready_to_braze',
    sequence: 40,
    label: 'Ready to braze',
    shortLabel: 'Ready to Braze',
    actor: 'field_inside',
    kind: 'step',
    prompt: 'Inside team is ready to braze and needs nitrogen flowing.',
    nextStepKeys: ['nitrogen_flowing'],
  },
  {
    key: 'nitrogen_flowing',
    sequence: 50,
    label: 'Nitrogen flowing',
    shortLabel: 'Nitrogen Flowing',
    actor: 'field_outside',
    kind: 'step',
    prompt: 'Outside team confirms nitrogen is flowing.',
    nextStepKeys: ['ready_to_test'],
  },
  {
    key: 'ready_to_test',
    sequence: 60,
    label: 'Ready to test',
    shortLabel: 'Ready to Test',
    actor: 'field_inside',
    kind: 'step',
    prompt: 'Inside team is ready for the pressure test.',
    nextStepKeys: ['test_on'],
  },
  {
    key: 'test_on',
    sequence: 70,
    label: 'Test on',
    shortLabel: 'Test On',
    actor: 'field_outside',
    kind: 'step',
    prompt: 'Pressure test is live. Mark a leak or confirm that the test is holding.',
    nextStepKeys: ['leak_here', 'test_holding'],
  },
  {
    key: 'leak_here',
    sequence: 80,
    label: 'Leak here',
    shortLabel: 'Leak Here',
    actor: 'shared',
    kind: 'branch',
    prompt: 'A leak was found. Loop back to braze prep for the next pass.',
    nextStepKeys: ['ready_to_braze'],
  },
  {
    key: 'test_holding',
    sequence: 90,
    label: 'Test holding',
    shortLabel: 'Test Holding',
    actor: 'field_outside',
    kind: 'step',
    prompt: 'Pressure test is holding and the crew can move to vacuum.',
    nextStepKeys: ['vac_pulling'],
  },
  {
    key: 'vac_pulling',
    sequence: 100,
    label: 'Vac pulling',
    shortLabel: 'Vac Pulling',
    actor: 'field_outside',
    kind: 'step',
    prompt: 'Outside team confirms the vacuum pull has started.',
    nextStepKeys: ['vac_good'],
  },
  {
    key: 'vac_good',
    sequence: 110,
    label: 'Vac good',
    shortLabel: 'Vac Good',
    actor: 'field_outside',
    kind: 'step',
    prompt: 'Vacuum is good. Execution relay is complete.',
    nextStepKeys: [],
  },
]

export const EXECUTION_RELAY_STEPS = executionRelaySteps
export const EXECUTION_RELAY_START_STEP_KEY: JobRelayStepKey = 'recovery_complete'

export const RELAY_STEP_BY_KEY: Record<JobRelayStepKey, JobRelayStepDefinition> = EXECUTION_RELAY_STEPS.reduce(
  (accumulator, step) => {
    accumulator[step.key] = step
    return accumulator
  },
  {} as Record<JobRelayStepKey, JobRelayStepDefinition>,
)

export function getRelayActorLabel(actor: JobRelayActor) {
  switch (actor) {
    case 'field_outside':
      return 'FO'
    case 'field_inside':
      return 'FI'
    default:
      return 'FO/FI'
  }
}

export function getRelayActorTone(actor: JobRelayActor) {
  switch (actor) {
    case 'field_outside':
      return { bg: '#eef5ff', fg: '#1f4f8a', border: '#c8dcf5' }
    case 'field_inside':
      return { bg: '#edf8f1', fg: '#1f6a46', border: '#c9e5d4' }
    default:
      return { bg: '#f6efe4', fg: '#7a4d11', border: '#e4d2b6' }
  }
}

export function getNextRelayStepKeys(currentStepKey: JobRelayStepKey | null) {
  if (!currentStepKey) return [EXECUTION_RELAY_START_STEP_KEY]
  return RELAY_STEP_BY_KEY[currentStepKey]?.nextStepKeys ?? []
}

export function getNextRelayCycle(currentStepKey: JobRelayStepKey | null, currentCycle: number | null | undefined) {
  if (!currentStepKey) return 1
  const normalizedCycle = currentCycle ?? 1
  return currentStepKey === 'leak_here' ? normalizedCycle + 1 : normalizedCycle
}

export function getRelayStatus(messages: Pick<JobMessage, 'message_type' | 'relay_step_key' | 'relay_cycle' | 'created_at'>[]): JobRelayStatus {
  const relayMessages = messages
    .filter((message): message is Pick<JobMessage, 'message_type' | 'relay_step_key' | 'relay_cycle' | 'created_at'> & { relay_step_key: JobRelayStepKey } =>
      message.message_type === 'relay' && !!message.relay_step_key,
    )
    .slice()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))

  const latestMessage = relayMessages[relayMessages.length - 1] ?? null
  const nextStepKeys = getNextRelayStepKeys(latestMessage?.relay_step_key ?? null)

  return {
    activeStepKeys: nextStepKeys,
    cycle: getNextRelayCycle(latestMessage?.relay_step_key ?? null, latestMessage?.relay_cycle ?? null),
    completed: nextStepKeys.length === 0,
  }
}

export interface JobMessage {
  id: string
  message_type: 'text' | 'quick_action' | 'system' | 'relay'
  body: string
  quick_action_key: string | null
  created_at: string
  user_id: string
  relay_step_key?: JobRelayStepKey | null
  relay_sequence?: number | null
  relay_actor?: JobRelayActor | null
  relay_kind?: JobRelayKind | null
  relay_cycle?: number | null
  users: {
    first_name: string
    last_name: string
  } | null
}

export type JobMessageRecord = Omit<JobMessage, 'users'> & {
  users: JobMessage['users'] | JobMessage['users'][]
}
