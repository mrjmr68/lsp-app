'use client'

import Link from 'next/link'
import Card from '@/app/components/field/Card'
import Button from '@/app/components/field/Button'
import CopyField from '@/app/components/field/CopyField'
import { buildMapsUrl, buildSmsUrl, buildTelUrl, formatAddress } from '@/utils/field/navigation'
import type { JobLocation, SiteContact } from '../types'

interface GoClientProps {
  jobId: string
  jobStatus: string
  customerName: string | null
  location: JobLocation | null
  unitLabel: string
  problemDescription: string | null
  contacts: SiteContact[]
  techFirstName: string | null
}

function isOnSite(jobStatus: string) {
  return jobStatus === 'on_site' || jobStatus === 'follow_up_active'
}

export default function GoClient({
  jobId,
  jobStatus,
  customerName,
  location,
  unitLabel,
  problemDescription,
  contacts,
  techFirstName,
}: GoClientProps) {
  const destinationParts = [location?.name, unitLabel].filter(Boolean)
  const destination = destinationParts.join(' · ')
  const address = location
    ? formatAddress({
        street_address: location.street_address,
        city: location.city,
        state: location.state,
        zip: location.zip,
        name: location.name,
      })
    : ''
  const mapsUrl = location ? buildMapsUrl(location) : null
  const primaryContact = contacts.find(c => c.is_primary) ?? contacts[0] ?? null
  const onSite = isOnSite(jobStatus)

  const smsMessage = [
    `Hi, this is ${techFirstName ?? 'your technician'} from Legend Service Pros.`,
    `I'm heading to ${destination || location?.name || 'your location'} now for your HVAC service.`,
    problemDescription ? `Issue: ${problemDescription}` : null,
  ].filter(Boolean).join(' ')

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Go
        </div>
        <h1 className="text-xl font-bold text-stone-900">{destination || 'Head to site'}</h1>
        {customerName && (
          <div className="mt-1 text-sm text-stone-600">{customerName}</div>
        )}
      </div>

      {address && (
        <Card>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Address
          </div>
          <div className="text-base font-medium leading-snug text-stone-900">{address}</div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white no-underline"
            >
              Open in Maps
            </a>
          )}
        </Card>
      )}

      {location?.access_notes && (
        <CopyField label="Access" value={location.access_notes} />
      )}

      {!location?.access_notes && (
        <Card>
          <div className="text-sm text-stone-500">
            No access notes on file for this location. Check Context for site history or ask the office.
          </div>
        </Card>
      )}

      {primaryContact?.phone ? (
        <Card>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Site contact
          </div>
          <div className="text-base font-semibold text-stone-900">
            {primaryContact.first_name} {primaryContact.last_name}
          </div>
          {primaryContact.role && (
            <div className="text-sm text-stone-500">{primaryContact.role}</div>
          )}
          <div className="mt-3 grid gap-2">
            <a
              href={buildSmsUrl(primaryContact.phone, smsMessage)}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white no-underline"
            >
              Text: On my way
            </a>
            <a
              href={buildTelUrl(primaryContact.phone)}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 no-underline"
            >
              Call contact
            </a>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-sm text-stone-500">
            No site contact with a phone number on file. Add a customer contact in the office, or call the office for access details.
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          When you arrive
        </div>
        <p className="mb-3 text-sm leading-relaxed text-stone-600">
          {onSite
            ? 'You are checked in. Head back to the hub to document the system or continue the repair.'
            : 'Check in when you reach the site so the office knows you are there and the timer starts.'}
        </p>
        {onSite ? (
          <Link href={`/jobs/${jobId}`} className="no-underline">
            <Button variant="primary" fullWidth>
              Back to job hub
            </Button>
          </Link>
        ) : (
          <Link href={`/jobs/${jobId}/arrive`} className="no-underline">
            <Button variant="primary" fullWidth>
              Check in on site
            </Button>
          </Link>
        )}
      </Card>
    </div>
  )
}
