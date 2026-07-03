import { redirect } from 'next/navigation'

export default async function VisitRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/visits/${id}/transit`)
}
