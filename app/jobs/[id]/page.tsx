import { notFound } from 'next/navigation'
import { getJobFull, getJobSummary, getServiceHistory, getSiteContacts } from './queries'
import SidekickJob from './SidekickJob'

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [summary, job] = await Promise.all([getJobSummary(id), getJobFull(id)])

  if (!summary || !job) return notFound()

  const customerId = job.customers?.id
  const [serviceHistory, people] = await Promise.all([
    getServiceHistory(id, job.system_id),
    customerId ? getSiteContacts(customerId) : Promise.resolve([]),
  ])

  return (
    <SidekickJob
      jobId={summary.id}
      momentInput={{
        jobStatus: summary.job_status,
        commercialState: summary.commercial_state,
        resolutionType: summary.resolution_type,
        arrivedAt: summary.arrived_at,
        departedAt: summary.departed_at,
        completedAt: summary.completed_at,
        tstatMode: summary.tstat_mode,
        tstatFan: summary.tstat_fan,
        diagnosisId: summary.diagnosis_id,
        hasAdhocBundle: summary.has_adhoc_bundle,
      }}
      customerName={summary.customer_name}
      location={job.locations}
      unitLabel={job.units?.name ?? job.manual_unit ?? ''}
      problemDescription={job.problem_description}
      repairCode={job.diagnoses?.repair_code ?? null}
      serviceHistory={serviceHistory}
      people={people}
    />
  )
}
