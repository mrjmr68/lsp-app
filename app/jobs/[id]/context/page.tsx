import { redirect, notFound } from 'next/navigation'
import { getJobFull, getServiceHistory, getViewerRole } from '../queries'
import ContextClient from './ContextClient'

function toTitleLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : ''
}

export default async function ContextPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getViewerRole()
  if (!viewer.userId) redirect('/login')

  const job = await getJobFull(id)
  if (!job) return notFound()

  const serviceHistory = await getServiceHistory(id, job.system_id)

  const equipmentLabel = [
    job.systems?.make,
    toTitleLabel(job.systems?.system_type) || job.systems?.system_subtype,
    job.systems?.tonnage ? `${job.systems.tonnage}T` : null,
  ].filter(Boolean).join(' · ')

  return (
    <ContextClient
      jobId={job.id}
      serviceHistory={serviceHistory}
      system={job.systems}
      equipmentLabel={equipmentLabel || null}
      problemDescription={job.problem_description}
    />
  )
}
