import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExploreView from '@/components/explore/ExploreView'

import { getOrCreateMeEntity } from '@/lib/db'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Ensure root user entity and its graph_layout exist
  const me = await getOrCreateMeEntity(supabase, user.id)
  const { data: meLayout } = await supabase.from('graph_layout').select('entity_id').eq('entity_id', me.id).maybeSingle()
  if (!meLayout) {
    await supabase.from('graph_layout').insert({ entity_id: me.id, user_id: user.id, x: 0, y: 0 })
  }

  // Fetch counts for HUD
  const { count: nodeCount } = await supabase.from('entities').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)
  const { count: edgeCount } = await supabase.from('edges').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)

  return <ExploreView nodeCount={nodeCount || 0} edgeCount={edgeCount || 0} />
}
