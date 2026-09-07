import { redirect, notFound } from 'next/navigation'
import { getJobSummary, getViewerRole } from './queries'
import JobShell from './JobShell'
import { getMomentSituation } from '@/utils/field/moment'

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

  const titleParts = [summary.customer_name, summary.location_name, summary.unit_name].filter(Boolean)
  const title = titleParts.length > 0 ? titleParts.join(' · ') : 'Job'
  const situation = getMomentSituation(
    {
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
    },
    { locationName: summary.location_name },
  )

  return (
    <JobShell jobId={summary.id} title={title} situation={situation} arrivedAt={summary.arrived_at}>
      {children}
    </JobShell>
  )
}
