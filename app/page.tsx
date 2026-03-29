import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Route by role once profile is loaded
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // Techs go to their day view eventually — for now everyone lands on planning
  redirect('/planning')
}
