import { redirect } from 'next/navigation'

export default async function GoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/jobs/${id}`)
}
