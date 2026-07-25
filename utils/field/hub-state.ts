export type HubPhase =
  | 'planning'
  | 'en_route'
  | 'on_site'
  | 'document'
  | 'diagnose'
  | 'repair'
  | 'close'
  | 'done'

export interface HubPrimaryAction {
  label: string
  href: string
  description: string
}

export interface HubSpoke {
  key: string
  label: string
  description: string
  href: string
  emphasis?: 'recommended' | 'complete' | 'default'
}

interface HubInput {
  jobId: string
  jobStatus: string
  commercialState: string
  arrivedAt: string | null
  tstatMode: string | null
  tstatFan: string | null
  diagnosisId: string | null
  hasAdhocBundle: boolean
  hasWorkflow: boolean
}

export function getHubPhase(input: HubInput): HubPhase {
  const arrived = ['on_site', 'follow_up_active'].includes(input.jobStatus)
  const done = input.jobStatus === 'completed'
    || input.commercialState === 'invoiced'
    || input.commercialState === 'ready_for_invoice'

  if (done) return 'done'
  if (!arrived) return 'en_route'
  if (!input.tstatMode || !input.tstatFan) return 'document'
  if (!input.diagnosisId && !input.hasAdhocBundle) return 'diagnose'
  if (input.jobStatus === 'completed') return 'close'
  return 'repair'
}

export function getHubPrimaryAction(input: HubInput): HubPrimaryAction {
  const phase = getHubPhase(input)
  const base = `/jobs/${input.jobId}`

  switch (phase) {
    case 'done':
      return {
        label: 'View close-out',
        href: `${base}/close`,
        description: 'Review what was recorded on this job.',
      }
    case 'en_route':
      return {
        label: 'Head to site',
        href: `${base}/go`,
        description: 'Get directions, access info, and notify the contact.',
      }
    case 'document':
      return {
        label: 'Capture system data',
        href: `${base}/observe`,
        description: 'Record readings, photos, and equipment details.',
      }
    case 'diagnose':
      return {
        label: 'Select repair',
        href: `${base}/diagnose`,
        description: 'Choose the diagnosis that matches what you found.',
      }
    case 'repair':
      return {
        label: 'Continue repair',
        href: `${base}/work`,
        description: 'Add bundles, parts, and completion photos.',
      }
    case 'close':
      return {
        label: 'Close out job',
        href: `${base}/close`,
        description: 'Review the summary and send to invoice or estimate.',
      }
    default:
      return {
        label: 'Open job hub',
        href: base,
        description: 'Return to the job home screen.',
      }
  }
}

export function getHubSpokes(input: HubInput): HubSpoke[] {
  const base = `/jobs/${input.jobId}`
  const phase = getHubPhase(input)

  const spokes: HubSpoke[] = [
    {
      key: 'go',
      label: 'Go',
      description: 'Directions, access, text contact',
      href: `${base}/go`,
      emphasis: phase === 'en_route' ? 'recommended' : 'default',
    },
    {
      key: 'context',
      label: 'Context',
      description: 'Service history and equipment',
      href: `${base}/context`,
      emphasis: phase === 'en_route' || phase === 'document' ? 'recommended' : 'default',
    },
    {
      key: 'document',
      label: 'Document',
      description: 'Photos, readings, model/serial',
      href: `${base}/observe`,
      emphasis: phase === 'document' ? 'recommended' : 'default',
    },
    {
      key: 'diagnose',
      label: 'Diagnose',
      description: 'Search the repair catalog',
      href: `${base}/diagnose`,
      emphasis: phase === 'diagnose' ? 'recommended' : 'default',
    },
    {
      key: 'repair',
      label: 'Repair',
      description: 'Bundles, parts, and labor',
      href: `${base}/work`,
      emphasis: phase === 'repair' ? 'recommended' : 'default',
    },
    {
      key: 'close',
      label: 'Close',
      description: 'Wrap up and choose next step',
      href: `${base}/close`,
      emphasis: phase === 'close' || phase === 'done' ? 'recommended' : 'default',
    },
  ]

  if (input.hasWorkflow) {
    spokes.push({
      key: 'crew',
      label: 'Crew',
      description: 'Shared prep and coordination',
      href: `${base}/observe`,
      emphasis: 'default',
    })
  }

  return spokes
}

export function getHubStatusLabel(phase: HubPhase): string {
  switch (phase) {
    case 'en_route':
      return 'Ready to head out'
    case 'document':
      return 'On site — document system'
    case 'diagnose':
      return 'Ready to diagnose'
    case 'repair':
      return 'Repair in progress'
    case 'close':
      return 'Ready to close'
    case 'done':
      return 'Completed'
    default:
      return 'Scheduled'
  }
}
