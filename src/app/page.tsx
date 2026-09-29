import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExploreView from '@/components/explore/ExploreView'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch counts for HUD
  const { count: nodeCount } = await supabase.from('entities').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)
  const { count: edgeCount } = await supabase.from('edges').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)

  return <ExploreView nodeCount={nodeCount || 0} edgeCount={edgeCount || 0} />
}
