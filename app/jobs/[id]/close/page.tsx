import { redirect, notFound } from 'next/navigation'
import { getJobFull, getViewerRole, getDiagnoses, getExistingAddOns, getWorkflow, getJobMessages, getCrewMembers } from '../queries'
import CloseClient from './CloseClient'

export default async function ClosePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getViewerRole()
  if (!viewer.userId) redirect('/login')

  const job = await getJobFull(id)
  if (!job) return notFound()

  const [diagnoses, existingAddOns, workflow, jobMessages, crewMembers] = await Promise.all([
    getDiagnoses(),
    getExistingAddOns(id),
    getWorkflow(id),
    getJobMessages(id),
    getCrewMembers(id, job.assigned_tech, job.actual_tech),
  ])

  const selectedDiagnosis = job.diagnosis_id
    ? diagnoses.find(d => d.id === job.diagnosis_id) ?? null
    : null

  const workflowMode = job.adhoc_bundle && !job.diagnosis_id ? 'adhoc' as const : 'diagnosis' as const

  return (
    <CloseClient
      job={job}
      workflow={workflow}
      crewMembers={crewMembers}
      jobMessages={jobMessages}
      workflowMode={workflowMode}
      selectedDiagnosis={selectedDiagnosis}
      addOns={existingAddOns}
    />
  )
}
