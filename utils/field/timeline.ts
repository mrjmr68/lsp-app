export type TimelineKind = 'event' | 'message' | 'fact'

export interface TimelineItem {
  id: string
  kind: TimelineKind
  at: string
  title: string
  detail: string | null
}

export function eventTitle(eventType: string): string {
  switch (eventType) {
    case 'claimed':
      return 'Assigned'
    case 'departed':
      return 'Headed out'
    case 'arrived':
      return 'On site'
    case 'completed':
      return 'Visit wrapped'
    case 'reassigned':
      return 'Reassigned'
    case 'helper_added':
      return 'Helper added'
    case 'cancelled':
      return 'Cancelled'
    default:
      return eventType.replace(/_/g, ' ')
  }
}

export function formatTimelineTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function mergeTimeline(items: TimelineItem[]) {
  return [...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
