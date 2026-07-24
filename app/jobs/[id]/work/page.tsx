import { redirect, notFound } from 'next/navigation'
import { getJobFull, getViewerRole, getDiagnoses, getRepairBundles, getCatalogItems, getExistingAddOns, getWorkflow, getJobMessages, getCrewMembers } from '../queries'
import WorkClient from './WorkClient'
import InstallWorkspace from '../InstallWorkspace'

export default async function WorkPage({
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
          activeTab="messages"
        />
      </div>
    )
  }

  const [diagnoses, repairBundles, catalogItems, existingAddOns] = await Promise.all([
    getDiagnoses(),
    getRepairBundles(),
    getCatalogItems(),
    getExistingAddOns(id),
  ])

  const selectedDiagnosis = job.diagnosis_id
    ? diagnoses.find(d => d.id === job.diagnosis_id) ?? null
    : null

  const workflowMode = job.adhoc_bundle && !job.diagnosis_id ? 'adhoc' as const : 'diagnosis' as const

  return (
    <WorkClient
      job={job}
      workflowMode={workflowMode}
      selectedDiagnosis={selectedDiagnosis}
      repairBundles={repairBundles}
      catalogItems={catalogItems}
      existingAddOns={existingAddOns}
    />
  )
}
