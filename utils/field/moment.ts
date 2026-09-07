export type FieldMoment =
  | 'up_next'
  | 'heading'
  | 'on_site'
  | 'working'
  | 'wrapping'
  | 'away'

export interface MomentInput {
  jobStatus: string
  commercialState: string
  resolutionType?: string | null
  arrivedAt: string | null
  departedAt?: string | null
  completedAt?: string | null
  tstatMode: string | null
  tstatFan: string | null
  diagnosisId: string | null
  hasAdhocBundle: boolean
}

export interface MomentAction {
  label: string
  href: string
  hint: string
}

const WAITING_COMMERCIAL = new Set([
  'estimate_needed',
  'estimate_sent',
  'approval_pending',
  'approved',
  'parts_needed',
  'parts_ordered',
  'ready_to_schedule',
])

const FINISHED_COMMERCIAL = new Set(['ready_for_invoice', 'invoiced'])

export function getFieldMoment(input: MomentInput): FieldMoment {
  const status = input.jobStatus
  const commercial = input.commercialState
  const onSite = status === 'on_site' || status === 'follow_up_active'
  const decided = Boolean(input.diagnosisId || input.hasAdhocBundle)
  const captured = Boolean(input.tstatMode && input.tstatFan)

  if (status === 'cancelled') return 'away'

  if (status === 'completed' || FINISHED_COMMERCIAL.has(commercial)) {
    return onSite ? 'wrapping' : 'away'
  }

  if (!onSite && (
    status === 'follow_up_planning'
    || status === 'follow_up_scheduled'
    || WAITING_COMMERCIAL.has(commercial)
  )) {
    return 'away'
  }

  if (onSite) {
    if (decided) return 'working'
    if (captured) return 'working'
    return 'on_site'
  }

  if (status === 'dispatched' || input.departedAt) return 'heading'

  return 'up_next'
}

export function getMomentSituation(input: MomentInput, extras?: {
  locationName?: string | null
  lastVisitLabel?: string | null
  repairCode?: string | null
}): string {
  const moment = getFieldMoment(input)
  const place = extras?.locationName?.trim() || 'the job'
  const last = extras?.lastVisitLabel
  const repair = extras?.repairCode

  switch (moment) {
    case 'up_next':
      return `Next up: ${place}. Start the run when you leave.`
    case 'heading':
      return `Heading to ${place}. Contacts and access are on this job.`
    case 'on_site':
      return last
        ? `On site. Last visit ${last}. Capture what the system is doing.`
        : `On site. No prior visits on file — this one becomes the record.`
    case 'working':
      if (repair) return `On site. ${repair} selected. Finish the work and wrap.`
      if (input.tstatMode) return `On site. Readings are in. Name what’s wrong.`
      return `On site. Keep going — the job is in motion.`
    case 'wrapping':
      return `Ready to leave a clean record for the office.`
    case 'away':
      return waitingCopy(input.commercialState, input.jobStatus, place)
    default:
      return `This job is ${place}.`
  }
}

function waitingCopy(commercial: string, status: string, place: string) {
  switch (commercial) {
    case 'estimate_needed':
    case 'estimate_sent':
    case 'approval_pending':
      return `${place} is waiting on approval.`
    case 'parts_needed':
    case 'parts_ordered':
      return `${place} is waiting on a part.`
    case 'ready_to_schedule':
    case 'approved':
      return `${place} is ready to schedule back.`
    case 'ready_for_invoice':
      return `${place} is ready for invoice.`
    case 'invoiced':
      return `${place} is invoiced.`
    default:
      if (status === 'cancelled') return `${place} was cancelled.`
      if (status === 'follow_up_planning' || status === 'follow_up_scheduled') {
        return `${place} still needs a return visit.`
      }
      return `${place} is not the active stop right now.`
  }
}

export function getMomentAction(input: MomentInput, jobId: string): MomentAction {
  const moment = getFieldMoment(input)
  const base = `/jobs/${jobId}`
  const decided = Boolean(input.diagnosisId || input.hasAdhocBundle)

  switch (moment) {
    case 'up_next':
      return {
        label: 'Start run',
        href: `${base}/go`,
        hint: 'Directions, access, and who to notify.',
      }
    case 'heading':
      return {
        label: 'I’m on site',
        href: `${base}/arrive`,
        hint: 'Check in so the timer starts and history comes forward.',
      }
    case 'on_site':
      return {
        label: 'Capture what’s happening',
        href: `${base}/observe`,
        hint: 'Photos and the few readings this call needs.',
      }
    case 'working':
      if (!decided) {
        return {
          label: 'What’s wrong?',
          href: `${base}/diagnose`,
          hint: 'Pick the repair from the catalog, or describe ad-hoc work.',
        }
      }
      return {
        label: 'Finish the repair',
        href: `${base}/work`,
        hint: 'Bundles, extra parts, and the completion photo.',
      }
    case 'wrapping':
      return {
        label: 'Wrap this visit',
        href: `${base}/close`,
        hint: 'Invoice, estimate, parts, or a return — then the next stop.',
      }
    case 'away':
      return {
        label: 'Open the job record',
        href: `${base}/close`,
        hint: 'This visit is not the live stop. The record is still here.',
      }
  }
}

export function getMomentLabel(moment: FieldMoment): string {
  switch (moment) {
    case 'up_next':
      return 'Up next'
    case 'heading':
      return 'Heading there'
    case 'on_site':
      return 'On site'
    case 'working':
      return 'Working'
    case 'wrapping':
      return 'Wrapping up'
    case 'away':
      return 'Away'
  }
}
