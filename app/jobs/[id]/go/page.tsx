import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getJobFull, getSiteContacts, getViewerRole } from '../queries'
import GoClient from './GoClient'

export default async function GoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getViewerRole()
  if (!viewer.userId) redirect('/login')

  const supabase = await createClient()
  const job = await getJobFull(id)
  if (!job) return notFound()

  const customerId = job.customers?.id
  if (!customerId) return notFound()

  const [contacts, { data: techProfile }] = await Promise.all([
    getSiteContacts(customerId),
    supabase
      .from('users')
      .select('first_name')
      .eq('id', viewer.userId)
      .maybeSingle(),
  ])

  return (
    <GoClient
      jobId={job.id}
      jobStatus={job.job_status}
      customerName={job.customers?.name ?? null}
      location={job.locations}
      unitLabel={job.units?.name ?? job.manual_unit ?? ''}
      problemDescription={job.problem_description}
      contacts={contacts}
      techFirstName={techProfile?.first_name ?? null}
    />
  )
}
