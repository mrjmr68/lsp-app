import Card from '@/app/components/field/Card'
import ActionLink from '@/app/components/field/ActionLink'
import { buildMapsUrl, buildSmsUrl, buildTelUrl, formatAddress } from '@/utils/field/navigation'
import { formatTimelineTime } from '@/utils/field/timeline'
import { getFieldMoment, getMomentAction, getMomentLabel, type MomentInput } from '@/utils/field/moment'
import type { HistoryJob, JobLocation, SiteContact } from './types'

interface TimelineEntry {
  id: string
  kind: 'event' | 'message' | 'fact'
  at: string
  title: string
  detail: string | null
}

interface JobChassisProps {
  jobId: string
  momentInput: MomentInput
  customerName: string | null
  location: JobLocation | null
  unitLabel: string
  problemDescription: string | null
  equipmentLabel: string | null
  repairCode: string | null
  serviceHistory: HistoryJob[]
  people: SiteContact[]
  timeline: TimelineEntry[]
}

function formatJobDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function JobChassis({
  jobId,
  momentInput,
  customerName,
  location,
  unitLabel,
  problemDescription,
  equipmentLabel,
  repairCode,
  serviceHistory,
  people,
  timeline,
}: JobChassisProps) {
  const moment = getFieldMoment(momentInput)
  const action = getMomentAction(momentInput, jobId)
  const onSite = moment === 'on_site' || moment === 'working' || moment === 'wrapping'
  const lastVisit = serviceHistory[0]
  const destination = [location?.name, unitLabel].filter(Boolean).join(' · ')
  const address = location ? formatAddress(location) : ''
  const mapsUrl = location ? buildMapsUrl(location) : null
  const etaMessage = [
    'This is Legend Service Pros.',
    `Heading to ${destination || location?.name || 'your location'} now for HVAC service.`,
  ].join(' ')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-8">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              {getMomentLabel(moment)}
            </div>
            <h1 className="text-xl font-bold leading-tight text-stone-900">
              {destination || customerName || 'This job'}
            </h1>
            {customerName && destination && (
              <div className="mt-1 text-sm text-stone-600">{customerName}</div>
            )}
          </div>

          <Card accent>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
              This visit
            </div>
            <div className="mt-1 text-lg font-semibold leading-snug text-white">
              {problemDescription || repairCode || 'Service call'}
            </div>
            {equipmentLabel && (
              <div className="mt-2 text-sm text-stone-300">{equipmentLabel}</div>
            )}
          </Card>

          {(moment === 'up_next' || moment === 'heading') && (
            <Card>
              {address ? (
                <>
                  <div className="text-base font-medium leading-snug text-stone-900">{address}</div>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white no-underline"
                    >
                      Open in Maps
                    </a>
                  )}
                </>
              ) : (
                <div className="text-sm text-stone-500">No street address on file for this location.</div>
              )}
              {location?.access_notes && (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-950">
                  Access: {location.access_notes}
                </div>
              )}
            </Card>
          )}

          {onSite && (
            <Card>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                History
              </div>
              {lastVisit ? (
                <div>
                  <div className="text-base font-semibold text-stone-900">
                    {lastVisit.diagnoses?.repair_code ?? 'Prior visit'}
                  </div>
                  <div className="text-sm text-stone-500">{formatJobDate(lastVisit.job_date)}</div>
                  {serviceHistory.length > 1 && (
                    <div className="mt-2 text-xs text-stone-500">
                      {serviceHistory.length} completed visits on this equipment
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-stone-500">
                  No prior completed visits on this system. Today becomes the baseline.
                </div>
              )}
              {equipmentLabel && (
                <div className="mt-3 border-t border-stone-100 pt-3 text-sm text-stone-700">
                  {equipmentLabel}
                </div>
              )}
            </Card>
          )}

          <Card>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              People
            </div>
            {people.length > 0 ? (
              <div className="flex flex-col gap-3">
                {people.map(person => {
                  const name = `${person.first_name} ${person.last_name}`.trim()
                  return (
                    <div key={person.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-stone-900">{name}</div>
                        <div className="text-xs text-stone-500">
                          {[person.is_primary ? 'Primary' : null, person.role].filter(Boolean).join(' · ') || 'Contact'}
                        </div>
                      </div>
                      {person.phone && (
                        <div className="flex shrink-0 gap-2">
                          <a
                            href={buildSmsUrl(person.phone, etaMessage)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 no-underline"
                          >
                            Text
                          </a>
                          <a
                            href={buildTelUrl(person.phone)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 no-underline"
                          >
                            Call
                          </a>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-stone-500">
                No contacts on file yet. The office can add them on the customer record.
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              What happened
            </div>
            {timeline.length > 0 ? (
              <ol className="flex flex-col gap-3">
                {timeline.map(item => (
                  <li key={item.id} className="border-l-2 border-stone-200 pl-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      {formatTimelineTime(item.at)}
                    </div>
                    <div className="text-sm font-semibold text-stone-900">{item.title}</div>
                    {item.detail && (
                      <div className="text-sm leading-snug text-stone-600">{item.detail}</div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-stone-500">
                Nothing logged yet. Start the run and the job will start writing itself.
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="shrink-0 border-t border-stone-200 bg-white p-4">
        <div className="mx-auto w-full max-w-lg">
          <ActionLink href={action.href}>{action.label}</ActionLink>
          <p className="mt-2 text-center text-xs text-stone-500">{action.hint}</p>
        </div>
      </div>
    </div>
  )
}
