'use client'

import Link from 'next/link'
import Card from '@/app/components/field/Card'
import Button from '@/app/components/field/Button'
import type { HistoryJob, JobSystem } from '../types'

interface ContextClientProps {
  jobId: string
  serviceHistory: HistoryJob[]
  system: JobSystem | null
  equipmentLabel: string | null
  problemDescription: string | null
}

function formatJobDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ContextClient({
  jobId,
  serviceHistory,
  system,
  equipmentLabel,
  problemDescription,
}: ContextClientProps) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Context
        </div>
        <h1 className="text-xl font-bold text-stone-900">Before you touch the unit</h1>
      </div>

      {problemDescription && (
        <Card>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Reported issue
          </div>
          <div className="text-base leading-relaxed text-stone-900">{problemDescription}</div>
        </Card>
      )}

      <Card>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Equipment on file
        </div>
        {equipmentLabel || system ? (
          <div className="space-y-2 text-sm text-stone-800">
            <div className="text-base font-semibold">{equipmentLabel || system?.name || 'Linked system'}</div>
            {system?.make && <div>Make: {system.make}</div>}
            {system?.model && <div>Model: {system.model}</div>}
            {system?.serial_number && <div>Serial: {system.serial_number}</div>}
            {system?.equipment_location && <div>Location: {system.equipment_location}</div>}
            {system?.thermostat_location && <div>T-stat: {system.thermostat_location}</div>}
          </div>
        ) : (
          <div className="text-sm text-stone-500">
            No equipment linked yet. You will establish the record in Document.
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Service history
        </div>
        {serviceHistory.length > 0 ? (
          <div className="divide-y divide-stone-100">
            {serviceHistory.map(entry => (
              <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-semibold text-stone-900">
                    {entry.diagnoses?.repair_code ?? 'Completed visit'}
                  </div>
                  <div className="shrink-0 text-xs text-stone-500">
                    {formatJobDate(entry.job_date)}
                  </div>
                </div>
                {entry.manual_unit && (
                  <div className="mt-0.5 text-xs text-stone-500">{entry.manual_unit}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-stone-500">
            No prior completed visits on this system. Today&apos;s work becomes the baseline record.
          </div>
        )}
      </Card>

      <Link href={`/jobs/${jobId}`} className="no-underline">
        <Button variant="secondary" fullWidth>
          Back to job hub
        </Button>
      </Link>
    </div>
  )
}
