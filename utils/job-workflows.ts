export type JobWorkflowType = 'install' | 'major_repair'
export type JobWorkflowPhase = 'prep' | 'materials' | 'execution' | 'closeout'
export type JobMessageType = 'text' | 'quick_action' | 'system'
export type QuickActionKey =
  | 'power_off'
  | 'nitrogen_braze'
  | 'nitrogen_test'
  | 'lineset_purge'
  | 'vacuum_started'
  | 'vacuum_passed'
  | 'power_on'
  | 'charge_started'
  | 'startup_complete'

export interface WorkflowSeedItem {
  phase: JobWorkflowPhase
  sortOrder: number
  label: string
  details?: string
  actionKey?: QuickActionKey
  required?: boolean
}

export interface WorkflowQuickAction {
  key: QuickActionKey
  label: string
}

export const WORKFLOW_QUICK_ACTIONS: WorkflowQuickAction[] = [
  { key: 'power_off', label: 'Power Off' },
  { key: 'nitrogen_braze', label: 'Nitrogen - Braze' },
  { key: 'nitrogen_test', label: 'Nitrogen - Test' },
  { key: 'lineset_purge', label: 'Lineset Purge' },
  { key: 'vacuum_started', label: 'Vacuum Started' },
  { key: 'vacuum_passed', label: 'Vacuum Passed' },
  { key: 'power_on', label: 'Power On' },
  { key: 'charge_started', label: 'Charge Started' },
  { key: 'startup_complete', label: 'Startup Complete' },
]

const BASE_PREP_ITEMS: WorkflowSeedItem[] = [
  { phase: 'prep', sortOrder: 10, label: 'Scope reviewed with the crew' },
  { phase: 'prep', sortOrder: 20, label: 'Access, parking, and site contacts confirmed' },
  { phase: 'prep', sortOrder: 30, label: 'Tools, ladders, and test instruments loaded' },
]

const BASE_MATERIAL_ITEMS: WorkflowSeedItem[] = [
  { phase: 'materials', sortOrder: 10, label: 'Primary equipment loaded' },
  { phase: 'materials', sortOrder: 20, label: 'Required material list loaded' },
  { phase: 'materials', sortOrder: 30, label: 'Recovery, nitrogen, and vacuum kit loaded' },
]

const INSTALL_EXECUTION_ITEMS: WorkflowSeedItem[] = [
  { phase: 'execution', sortOrder: 10, label: 'Power Off', actionKey: 'power_off' },
  { phase: 'execution', sortOrder: 20, label: 'Nitrogen - Braze', actionKey: 'nitrogen_braze' },
  { phase: 'execution', sortOrder: 30, label: 'Lineset Purge', actionKey: 'lineset_purge' },
  { phase: 'execution', sortOrder: 40, label: 'Nitrogen - Test', actionKey: 'nitrogen_test' },
  { phase: 'execution', sortOrder: 50, label: 'Vacuum Started', actionKey: 'vacuum_started' },
  { phase: 'execution', sortOrder: 60, label: 'Vacuum Passed', actionKey: 'vacuum_passed' },
  { phase: 'execution', sortOrder: 70, label: 'Charge Started', actionKey: 'charge_started', required: false },
  { phase: 'execution', sortOrder: 80, label: 'Power On', actionKey: 'power_on' },
  { phase: 'execution', sortOrder: 90, label: 'Startup Complete', actionKey: 'startup_complete' },
]

const CLOSEOUT_ITEMS: WorkflowSeedItem[] = [
  { phase: 'closeout', sortOrder: 10, label: 'Panels secured and area cleaned' },
  { phase: 'closeout', sortOrder: 20, label: 'Photos and final notes captured' },
  { phase: 'closeout', sortOrder: 30, label: 'System operation verified before departure' },
]

const MAJOR_REPAIR_EXECUTION_ITEMS: WorkflowSeedItem[] = [
  { phase: 'execution', sortOrder: 10, label: 'Power Off', actionKey: 'power_off' },
  { phase: 'execution', sortOrder: 20, label: 'Nitrogen - Braze', actionKey: 'nitrogen_braze', required: false },
  { phase: 'execution', sortOrder: 30, label: 'Lineset Purge', actionKey: 'lineset_purge', required: false },
  { phase: 'execution', sortOrder: 40, label: 'Nitrogen - Test', actionKey: 'nitrogen_test', required: false },
  { phase: 'execution', sortOrder: 50, label: 'Vacuum Started', actionKey: 'vacuum_started', required: false },
  { phase: 'execution', sortOrder: 60, label: 'Vacuum Passed', actionKey: 'vacuum_passed', required: false },
  { phase: 'execution', sortOrder: 70, label: 'Power On', actionKey: 'power_on' },
  { phase: 'execution', sortOrder: 80, label: 'Startup Complete', actionKey: 'startup_complete' },
]

export function buildWorkflowSeedItems(workflowType: JobWorkflowType): WorkflowSeedItem[] {
  return [
    ...BASE_PREP_ITEMS,
    ...BASE_MATERIAL_ITEMS,
    ...(workflowType === 'install' ? INSTALL_EXECUTION_ITEMS : MAJOR_REPAIR_EXECUTION_ITEMS),
    ...CLOSEOUT_ITEMS,
  ].map(item => ({
    ...item,
    required: item.required ?? true,
  }))
}
