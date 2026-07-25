import { redirect, notFound } from 'next/navigation'
import { getJobSummary, getViewerRole } from './queries'
import JobShell from './JobShell'

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

  return (
    <JobShell jobId={summary.id} title={title} arrivedAt={summary.arrived_at}>
      {children}
    </JobShell>
  )
}
