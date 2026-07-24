import { redirect, notFound } from 'next/navigation'
import { getJobFull, getServiceHistory, getWorkflow, getCrewMembers, getViewerRole } from '../queries'
import ArriveClient from './ArriveClient'

export default async function ArrivePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getViewerRole()
  if (!viewer.userId) redirect('/login')

  const job = await getJobFull(id)
  if (!job) return notFound()

  const [serviceHistory, workflow, crewMembers] = await Promise.all([
    getServiceHistory(id, job.system_id),
    getWorkflow(id),
    getCrewMembers(id, job.assigned_tech, job.actual_tech),
  ])

  return (
    <ArriveClient
      viewerRole={viewer.role}
      job={job}
      serviceHistory={serviceHistory}
      workflow={workflow}
      crewMembers={crewMembers}
    />
  )
}
