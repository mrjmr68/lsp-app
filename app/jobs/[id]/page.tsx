import { redirect, notFound } from 'next/navigation'
import { getJobSummary, getViewerRole } from './queries'

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getViewerRole()
  if (!viewer.userId) redirect('/login')

  const job = await getJobSummary(id)
  if (!job) return notFound()

  const status = job.job_status ?? 'new'

  // Determine which step to land on based on job state
  if (status === 'completed' || status === 'invoiced') {
    redirect(`/jobs/${id}/close`)
  }

  const arrived = status === 'on_site' || status === 'follow_up_active'
  if (!arrived) {
    redirect(`/jobs/${id}/arrive`)
  }

  // Arrived — figure out how far the tech has progressed
  const hasObservations = !!job.tstat_mode && !!job.tstat_fan
  if (!hasObservations) {
    redirect(`/jobs/${id}/observe`)
  }

  const hasDiagnosis = !!job.diagnosis_id || job.has_adhoc_bundle
  if (!hasDiagnosis) {
    redirect(`/jobs/${id}/diagnose`)
  }

  // Has diagnosis → land on work
  redirect(`/jobs/${id}/work`)
}
