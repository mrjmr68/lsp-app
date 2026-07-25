import { notFound } from 'next/navigation'
import { getJobFull, getJobSummary, getServiceHistory } from './queries'
import JobHub from './JobHub'

function toTitleLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : ''
}

function formatJobDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function JobHubPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [summary, job] = await Promise.all([getJobSummary(id), getJobFull(id)])

  if (!summary || !job) return notFound()

  const serviceHistory = await getServiceHistory(id, job.system_id)

  const equipmentLabel = [
    job.systems?.make,
    toTitleLabel(job.systems?.system_type) || job.systems?.system_subtype,
    job.systems?.tonnage ? `${job.systems.tonnage}T` : null,
  ].filter(Boolean).join(' · ')

  const lastVisit = serviceHistory[0]

  return (
    <JobHub
      jobId={summary.id}
      customerName={summary.customer_name}
      locationName={summary.location_name}
      unitName={summary.unit_name}
      problemDescription={job.problem_description}
      equipmentLabel={equipmentLabel || null}
      lastVisitLabel={lastVisit ? formatJobDate(lastVisit.job_date) : null}
      jobStatus={summary.job_status}
      commercialState={summary.commercial_state}
      arrivedAt={summary.arrived_at}
      tstatMode={summary.tstat_mode}
      tstatFan={summary.tstat_fan}
      diagnosisId={summary.diagnosis_id}
      hasAdhocBundle={summary.has_adhoc_bundle}
      hasWorkflow={summary.has_workflow}
      repairCode={job.diagnoses?.repair_code ?? null}
    />
  )
}
