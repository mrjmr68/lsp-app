export type LegacyJobStatus =
  | 'new'
  | 'assigned'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'closed_no_diagnosis'
  | 'cancelled'
  | 'invoiced'

export type JobStatus =
  | 'intake'
  | 'scheduled'
  | 'dispatched'
  | 'on_site'
  | 'follow_up_planning'
  | 'follow_up_scheduled'
  | 'follow_up_active'
  | 'completed'
  | 'cancelled'

export type JobResolutionType =
  | 'standard_repair'
  | 'adhoc_repair'
  | 'repair_estimate'
  | 'parts_sourcing'
  | 'major_repair'
  | 'install'
  | 'closed_no_action'
  | 'monitor_only'

export type JobCommercialState =
  | 'none'
  | 'estimate_needed'
  | 'estimate_sent'
  | 'approval_pending'
  | 'approved'
  | 'parts_needed'
  | 'parts_ordered'
  | 'ready_to_schedule'
  | 'ready_for_invoice'
  | 'invoiced'

export const DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES: JobCommercialState[] = [
  'estimate_needed',
  'estimate_sent',
  'approval_pending',
  'approved',
  'parts_needed',
  'parts_ordered',
  'ready_to_schedule',
  'invoiced',
]

export const DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES_FILTER = `(${DAILY_OPERATIONS_HIDDEN_COMMERCIAL_STATES.join(',')})`

type StateMeta = {
  label: string
  bg: string
  fg: string
}

const legacyStatusMeta: Record<LegacyJobStatus, StateMeta> = {
  new: { label: 'new', bg: '#f1efe8', fg: '#5f5e5a' },
  assigned: { label: 'assigned', bg: '#eaf3de', fg: '#3b6d11' },
  en_route: { label: 'en route', bg: '#e6f1fb', fg: '#185fa5' },
  in_progress: { label: 'on site', bg: '#faeeda', fg: '#854f0b' },
  completed: { label: 'completed', bg: '#f1efe8', fg: '#5f5e5a' },
  closed_no_diagnosis: { label: 'no further action', bg: '#eeedfe', fg: '#3c3489' },
  cancelled: { label: 'cancelled', bg: '#fcebeb', fg: '#a32d2d' },
  invoiced: { label: 'invoiced', bg: '#e8f5ec', fg: '#25613a' },
}

const jobStatusMeta: Record<JobStatus, StateMeta> = {
  intake: { label: 'intake', bg: '#f1efe8', fg: '#5f5e5a' },
  scheduled: { label: 'scheduled', bg: '#eaf3de', fg: '#3b6d11' },
  dispatched: { label: 'dispatched', bg: '#e6f1fb', fg: '#185fa5' },
  on_site: { label: 'on site', bg: '#faeeda', fg: '#854f0b' },
  follow_up_planning: { label: 'follow-up planning', bg: '#eeedfe', fg: '#3c3489' },
  follow_up_scheduled: { label: 'follow-up scheduled', bg: '#e8f3f1', fg: '#0d6251' },
  follow_up_active: { label: 'follow-up active', bg: '#faeeda', fg: '#854f0b' },
  completed: { label: 'completed', bg: '#f1efe8', fg: '#5f5e5a' },
  cancelled: { label: 'cancelled', bg: '#fcebeb', fg: '#a32d2d' },
}

const resolutionTypeMeta: Record<JobResolutionType, StateMeta> = {
  standard_repair: { label: 'standard repair', bg: '#edf4fb', fg: '#275a8f' },
  adhoc_repair: { label: 'ad-hoc repair', bg: '#fff1da', fg: '#8a5800' },
  repair_estimate: { label: 'repair estimate', bg: '#eef1fd', fg: '#4152a3' },
  parts_sourcing: { label: 'parts sourcing', bg: '#e8f3f1', fg: '#0d6251' },
  major_repair: { label: 'major repair', bg: '#f6ead9', fg: '#7d4c05' },
  install: { label: 'install', bg: '#e4f4ec', fg: '#1d6b46' },
  closed_no_action: { label: 'closed / no action', bg: '#eeedfe', fg: '#3c3489' },
  monitor_only: { label: 'monitor only', bg: '#f1efe8', fg: '#5f5e5a' },
}

const commercialStateMeta: Record<JobCommercialState, StateMeta> = {
  none: { label: 'none', bg: '#f1efe8', fg: '#5f5e5a' },
  estimate_needed: { label: 'estimate needed', bg: '#fff1da', fg: '#8a5800' },
  estimate_sent: { label: 'estimate sent', bg: '#eef1fd', fg: '#4152a3' },
  approval_pending: { label: 'approval pending', bg: '#eeedfe', fg: '#3c3489' },
  approved: { label: 'approved', bg: '#eaf3de', fg: '#3b6d11' },
  parts_needed: { label: 'parts needed', bg: '#fff1da', fg: '#8a5800' },
  parts_ordered: { label: 'parts ordered', bg: '#e8f3f1', fg: '#0d6251' },
  ready_to_schedule: { label: 'ready to schedule', bg: '#edf7f1', fg: '#1d6b46' },
  ready_for_invoice: { label: 'ready for invoice', bg: '#eef5ea', fg: '#42621c' },
  invoiced: { label: 'invoiced', bg: '#e8f5ec', fg: '#25613a' },
}

export function getLegacyStatusFromLifecycle(
  jobStatus: JobStatus | string | null | undefined,
  commercialState: JobCommercialState | string | null | undefined,
  resolutionType: JobResolutionType | string | null | undefined,
): LegacyJobStatus {
  if (commercialState === 'invoiced') return 'invoiced'
  if (jobStatus === 'cancelled') return 'cancelled'
  if (jobStatus === 'completed') {
    return resolutionType === 'closed_no_action' ? 'closed_no_diagnosis' : 'completed'
  }
  if (jobStatus === 'on_site' || jobStatus === 'follow_up_active') return 'in_progress'
  if (jobStatus === 'dispatched') return 'en_route'
  if (jobStatus === 'scheduled' || jobStatus === 'follow_up_planning' || jobStatus === 'follow_up_scheduled') return 'assigned'
  return 'new'
}

export function getJobStatusFromLegacy(status: LegacyJobStatus | string | null | undefined): JobStatus {
  switch (status) {
    case 'assigned':
      return 'scheduled'
    case 'en_route':
      return 'dispatched'
    case 'in_progress':
      return 'on_site'
    case 'completed':
    case 'closed_no_diagnosis':
    case 'invoiced':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'intake'
  }
}

export function getCommercialStateFromLegacy(status: LegacyJobStatus | string | null | undefined): JobCommercialState {
  switch (status) {
    case 'completed':
      return 'ready_for_invoice'
    case 'invoiced':
      return 'invoiced'
    default:
      return 'none'
  }
}

export function getJobStatusMeta(status: JobStatus | string | null | undefined): StateMeta {
  const normalized = (status ?? 'intake') as JobStatus
  return jobStatusMeta[normalized] ?? jobStatusMeta.intake
}

export function getResolutionTypeMeta(resolutionType: JobResolutionType | string | null | undefined): StateMeta | null {
  if (!resolutionType) return null
  const normalized = resolutionType as JobResolutionType
  return resolutionTypeMeta[normalized] ?? null
}

export function getCommercialStateMeta(commercialState: JobCommercialState | string | null | undefined): StateMeta | null {
  if (!commercialState) return null
  const normalized = commercialState as JobCommercialState
  return commercialStateMeta[normalized] ?? null
}

export function getPrimaryJobStateMeta(
  jobStatus: JobStatus | string | null | undefined,
  commercialState: JobCommercialState | string | null | undefined,
  resolutionType: JobResolutionType | string | null | undefined,
): StateMeta {
  if (commercialState === 'invoiced') return commercialStateMeta.invoiced
  if (jobStatus === 'completed' && resolutionType === 'closed_no_action') {
    return resolutionTypeMeta.closed_no_action
  }
  return getJobStatusMeta(jobStatus)
}

export function getLegacyStatusMeta(status: LegacyJobStatus | string | null | undefined): StateMeta {
  const normalized = (status ?? 'new') as LegacyJobStatus
  return legacyStatusMeta[normalized] ?? legacyStatusMeta.new
}

export function getResolutionTypeForWorkflow(workflowType: string | null | undefined): JobResolutionType | null {
  if (workflowType === 'install') return 'install'
  if (workflowType === 'major_repair') return 'major_repair'
  return null
}
