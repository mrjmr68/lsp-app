'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markArrived } from './actions'

function getGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 },
    )
  })
}

export function ArriveButton({
  jobId,
  label = 'I’m here',
}: {
  jobId: string
  label?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null)
          start(async () => {
            const position = await getGps()
            const result = await markArrived(jobId, position?.lat ?? null, position?.lng ?? null)
            if (result.error) {
              setError(result.error)
              return
            }
            router.refresh()
          })
        }}
        className="block w-full cursor-pointer rounded-2xl border-0 bg-[#1a1a18] py-[18px] font-sans text-lg font-semibold text-[#f5f4f0] disabled:cursor-wait"
      >
        {pending ? 'Marking…' : label}
      </button>
      {error && (
        <p className="mt-2.5 text-sm text-[#a32d2d]">{error}</p>
      )}
    </div>
  )
}
