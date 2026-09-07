import Link from 'next/link'

export type TodayJob = {
  id: string
  problem_description: string | null
  customers: { name: string } | null
  locations: { name: string } | null
}

type TodayViewProps = {
  techName: string
  nextJob: TodayJob | null
  laterJobs: TodayJob[]
}

function placeName(job: TodayJob): string {
  return job.locations?.name || job.customers?.name || 'This stop'
}

export function TodayView({ techName, nextJob, laterJobs }: TodayViewProps) {
  const first = techName.split(' ')[0] || 'there'

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#f5f4f0] px-6 pb-16 pt-6 text-[#1a1a18]">
      <header className="mb-12 flex items-baseline justify-between">
        <p className="m-0 text-[15px] font-medium text-[#6b6960]">Hi {first}</p>
        <a
          href="/auth/signout"
          className="text-[13px] font-medium text-[#6b6960] no-underline"
        >
          Sign out
        </a>
      </header>

      {!nextJob ? (
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6b6960]">
            Today
          </p>
          <h1 className="m-0 text-[32px] font-medium leading-[1.15] tracking-[-0.03em]">
            Nothing on the board yet.
          </h1>
          <p className="mt-4 text-base leading-snug text-[#6b6960]">
            When the office assigns a job, it will show up here.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6b6960]">
            Up next
          </p>
          <h1 className="m-0 text-[34px] font-medium leading-[1.12] tracking-[-0.035em]">
            {placeName(nextJob)}
          </h1>
          <p className="mt-3 mb-10 text-lg leading-snug text-[#6b6960]">
            {nextJob.problem_description?.trim() || 'Service call'}
          </p>

          <Link
            href={`/jobs/${nextJob.id}`}
            className="block rounded-2xl bg-[#1a1a18] py-[18px] text-center text-lg font-semibold text-[#f5f4f0] no-underline"
          >
            Let’s go
          </Link>

          {laterJobs.length > 0 && (
            <section className="mt-14">
              <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6b6960]">
                Later
              </p>
              <ul className="m-0 list-none p-0">
                {laterJobs.map(job => (
                  <li key={job.id} className="mb-5">
                    <Link href={`/jobs/${job.id}`} className="block text-inherit no-underline">
                      <span className="block text-[17px] font-medium">{placeName(job)}</span>
                      <span className="text-sm text-[#6b6960]">
                        {job.problem_description?.trim() || 'Service call'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
