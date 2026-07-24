import { redirect, notFound } from 'next/navigation'
import { getJobFull, getViewerRole, getDiagnoses, getWorkflow, getJobMessages, getCrewMembers } from '../queries'
import DiagnoseClient from './DiagnoseClient'
import InstallWorkspace from '../InstallWorkspace'

export default async function DiagnosePage({
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
          activeTab="execution"
        />
      </div>
    )
  }

  const diagnoses = await getDiagnoses()

  return <DiagnoseClient job={job} diagnoses={diagnoses} />
}
