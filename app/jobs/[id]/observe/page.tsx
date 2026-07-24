import { redirect, notFound } from 'next/navigation'
import { getJobFull, getViewerRole, getWorkflow, getJobMessages, getCrewMembers } from '../queries'
import ObserveClient from './ObserveClient'
import InstallWorkspace from '../InstallWorkspace'

export default async function ObservePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getViewerRole()
  if (!viewer.userId) redirect('/login')

  const job = await getJobFull(id)
  if (!job) return notFound()

  const workflow = await getWorkflow(id)

  if (workflow) {
    const [jobMessages, crewMembers] = await Promise.all([
      getJobMessages(id),
      getCrewMembers(id, job.assigned_tech, job.actual_tech),
    ])
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <InstallWorkspace
          jobId={job.id}
          workflow={workflow}
          jobMessages={jobMessages}
          crewMembers={crewMembers}
          currentUserId={viewer.userId}
          activeTab="prep"
        />
      </div>
    )
  }

  return <ObserveClient job={job} />
}
