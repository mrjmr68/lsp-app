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

  return (
    <JobShell jobId={summary.id} arrivedAt={summary.arrived_at}>
      {children}
    </JobShell>
  )
}
