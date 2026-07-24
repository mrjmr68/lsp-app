import { redirect, notFound } from 'next/navigation'
import { getJobSummary, getViewerRole } from './queries'
import JobHeader from './JobHeader'

export default async function JobLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [viewer, summary] = await Promise.all([getViewerRole(), getJobSummary(id)])

  if (!viewer.userId) redirect('/login')
  if (!summary) return notFound()

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #ece7dc 0%, #f5f1e7 38%, #f0ebe1 100%)',
        color: '#17191d',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <JobHeader
        jobId={summary.id}
        customerName={summary.customer_name}
        locationName={summary.location_name}
        unitName={summary.unit_name}
        arrivedAt={summary.arrived_at}
        jobStatus={summary.job_status}
        commercialState={summary.commercial_state}
        resolutionType={summary.resolution_type}
        tstatMode={summary.tstat_mode}
        tstatFan={summary.tstat_fan}
        diagnosisId={summary.diagnosis_id}
        hasAdhocBundle={summary.has_adhoc_bundle}
        hasWorkflow={summary.has_workflow}
      />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
