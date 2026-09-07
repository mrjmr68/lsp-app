import Link from 'next/link'
import type { ReactNode } from 'react'
import { getFieldMoment, getMomentAction, type MomentInput } from '@/utils/field/moment'
import { buildMapsUrl, buildSmsUrl, buildTelUrl, formatAddress } from '@/utils/field/navigation'
import type { HistoryJob, JobLocation, SiteContact } from './types'
import { ArriveButton } from './ArriveButton'

type SidekickJobProps = {
  jobId: string
  momentInput: MomentInput
  customerName: string | null
  location: JobLocation | null
  unitLabel: string
  problemDescription: string | null
  repairCode: string | null
  serviceHistory: HistoryJob[]
  people: SiteContact[]
}

function formatJobDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function contactName(person: SiteContact) {
  return `${person.first_name} ${person.last_name}`.trim()
}

function lastVisitLine(history: HistoryJob[]): string | null {
  const last = history[0]
  if (!last) return null
  const bits = [formatJobDate(last.job_date), last.diagnoses?.repair_code].filter(Boolean)
  return bits.length ? bits.join(' · ') : 'Been here before'
}

export default function SidekickJob({
  jobId,
  momentInput,
  customerName,
  location,
  unitLabel,
  problemDescription,
  repairCode,
  serviceHistory,
  people,
}: SidekickJobProps) {
  const moment = getFieldMoment(momentInput)
  const action = getMomentAction(momentInput, jobId)
  const place = location?.name || customerName || 'this job'
  const address = location ? formatAddress(location) : ''
  const maps = location ? buildMapsUrl(location) : null
  const person = people.find(c => c.is_primary) ?? people[0] ?? null
  const last = lastVisitLine(serviceHistory)
  const destination = [location?.name, unitLabel].filter(Boolean).join(' · ')
  const etaMessage = [
    'This is Legend Service Pros.',
    `Heading to ${destination || place} now for HVAC service.`,
  ].join(' ')

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#f5f4f0] px-6 pb-32 pt-3 text-[#1a1a18]">
      <header className="mb-10">
        <Link href="/jobs" className="text-[15px] font-medium text-[#6b6960] no-underline">
          Today
        </Link>
      </header>

      {(moment === 'up_next' || moment === 'heading') && (
        <DriveMoment
          heading={moment === 'heading'}
          place={place}
          address={address}
          access={location?.access_notes?.trim() || null}
          person={person}
          maps={maps}
          etaMessage={etaMessage}
          jobId={jobId}
        />
      )}

      {moment === 'on_site' && (
        <MomentCopy
          eyebrow="You’re here"
          title="What do you see?"
          quiet={last ? `Last time: ${last}` : 'No prior visits on file.'}
          href={action.href}
          cta="Look around"
        />
      )}

      {moment === 'working' && (
        <MomentCopy
          eyebrow="On it"
          title={repairCode ? `${repairCode}.` : 'What’s going on?'}
          quiet={problemDescription?.trim() || action.hint}
          href={action.href}
          cta={action.label === 'What’s wrong?' ? 'Write it down' : 'Keep going'}
        />
      )}

      {moment === 'wrapping' && (
        <MomentCopy
          eyebrow="Almost done"
          title="How did it go?"
          quiet="Fixed, estimate, parts, or come back — pick one."
          href={action.href}
          cta="Wrap this up"
        />
      )}

      {moment === 'away' && (
        <MomentCopy
          eyebrow="Not the live stop"
          title={place}
          quiet={action.hint}
          href="/jobs"
          cta="Back to today"
        />
      )}
    </div>
  )
}

function DriveMoment({
  heading,
  place,
  address,
  access,
  person,
  maps,
  etaMessage,
  jobId,
}: {
  heading: boolean
  place: string
  address: string
  access: string | null
  person: SiteContact | null
  maps: string | null
  etaMessage: string
  jobId: string
}) {
  const name = person ? contactName(person) : null

  return (
    <>
      <Eyebrow>{heading ? 'On the way' : 'Head there'}</Eyebrow>
      <Title>{place}</Title>
      {address && <Quiet>{address}</Quiet>}
      {access && <p className="mt-5 text-base leading-snug">{access}</p>}
      {name && (
        <p className="mt-3 text-base text-[#6b6960]">
          Ask for {name}
          {person?.phone ? ` · ${person.phone}` : ''}
        </p>
      )}

      <div className="mt-10 grid gap-3">
        {maps && (
          <a href={maps} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
            Maps
          </a>
        )}
        {person?.phone && (
          <div className="grid grid-cols-2 gap-3">
            <a href={buildTelUrl(person.phone)} className={ghostBtn}>Call</a>
            <a href={buildSmsUrl(person.phone, etaMessage)} className={ghostBtn}>Text</a>
          </div>
        )}
      </div>

      <Sticky>
        <ArriveButton jobId={jobId} />
        <p className="mt-3 text-center text-[13px] text-[#6b6960]">
          Tap when you pull up.
        </p>
      </Sticky>
    </>
  )
}

function MomentCopy({
  eyebrow,
  title,
  quiet,
  href,
  cta,
}: {
  eyebrow: string
  title: string
  quiet: string
  href: string
  cta: string
}) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      <Quiet>{quiet}</Quiet>
      <Sticky>
        <Link href={href} className={primaryBtn}>
          {cta}
        </Link>
      </Sticky>
    </>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6b6960]">
      {children}
    </p>
  )
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="m-0 text-[34px] font-medium leading-[1.12] tracking-[-0.035em]">
      {children}
    </h1>
  )
}

function Quiet({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3.5 text-[17px] leading-snug text-[#6b6960]">
      {children}
    </p>
  )
}

function Sticky({ children }: { children: ReactNode }) {
  return (
    <div className="fixed right-0 bottom-0 left-0 bg-gradient-to-t from-[#f5f4f0] from-[28%] to-transparent px-6 pt-8 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  )
}

const primaryBtn =
  'block rounded-2xl bg-[#1a1a18] py-[18px] text-center text-lg font-semibold text-[#f5f4f0] no-underline'

const ghostBtn =
  'block rounded-[14px] border border-[#e4e2d8] bg-white py-3.5 text-center text-base font-semibold text-[#1a1a18] no-underline'
