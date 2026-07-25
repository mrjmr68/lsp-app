'use client'

import Link from 'next/link'
import Card from '@/app/components/field/Card'
import Button from '@/app/components/field/Button'
import {
  getHubPhase,
  getHubPrimaryAction,
  getHubSpokes,
  getHubStatusLabel,
} from '@/utils/field/hub-state'

interface JobHubProps {
  jobId: string
  customerName: string | null
  locationName: string | null
  unitName: string | null
  problemDescription: string | null
  equipmentLabel: string | null
  lastVisitLabel: string | null
  jobStatus: string
  commercialState: string
  arrivedAt: string | null
  tstatMode: string | null
  tstatFan: string | null
  diagnosisId: string | null
  hasAdhocBundle: boolean
  hasWorkflow: boolean
  repairCode: string | null
}

function spokeClasses(emphasis?: 'recommended' | 'complete' | 'default') {
  if (emphasis === 'recommended') {
    return 'border-blue-200 bg-blue-50 ring-1 ring-blue-200'
  }
  if (emphasis === 'complete') {
    return 'border-emerald-200 bg-emerald-50'
  }
  return 'border-stone-200 bg-white'
}

export default function JobHub({
  jobId,
  customerName,
  locationName,
  unitName,
  problemDescription,
  equipmentLabel,
  lastVisitLabel,
  jobStatus,
  commercialState,
  arrivedAt,
  tstatMode,
  tstatFan,
  diagnosisId,
  hasAdhocBundle,
  hasWorkflow,
  repairCode,
}: JobHubProps) {
  const hubInput = {
    jobId,
    jobStatus,
    commercialState,
    arrivedAt,
    tstatMode,
    tstatFan,
    diagnosisId,
    hasAdhocBundle,
    hasWorkflow,
  }

  const phase = getHubPhase(hubInput)
  const primary = getHubPrimaryAction(hubInput)
  const spokes = getHubSpokes(hubInput)
  const statusLabel = getHubStatusLabel(phase)

  const titleParts = [customerName, locationName, unitName].filter(Boolean)
  const destination = titleParts.join(' · ')

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          {statusLabel}
        </div>
        <h1 className="text-xl font-bold leading-tight text-stone-900">
          {destination || 'Active job'}
        </h1>
      </div>

      <Card accent>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
          Working on
        </div>
        <div className="text-lg font-semibold leading-snug text-white">
          {problemDescription || repairCode || 'Service call'}
        </div>
        {equipmentLabel && (
          <div className="mt-2 text-sm text-stone-300">{equipmentLabel}</div>
        )}
        {lastVisitLabel && (
          <div className="mt-1 text-xs text-stone-400">Last visit: {lastVisitLabel}</div>
        )}
      </Card>

      <Link href={primary.href} className="no-underline">
        <Button variant="primary" fullWidth className="text-base">
          {primary.label}
        </Button>
      </Link>
      <p className="-mt-2 text-center text-xs text-stone-500">{primary.description}</p>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Job tools
        </div>
        <div className="grid grid-cols-2 gap-2">
          {spokes.map(spoke => (
            <Link
              key={spoke.key}
              href={spoke.href}
              className={[
                'rounded-2xl border p-3 no-underline transition-transform active:scale-[0.98]',
                spokeClasses(spoke.emphasis),
              ].join(' ')}
            >
              <div className="text-sm font-bold text-stone-900">{spoke.label}</div>
              <div className="mt-0.5 text-xs leading-snug text-stone-600">
                {spoke.description}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
