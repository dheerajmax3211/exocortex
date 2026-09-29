import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExploreView from '@/components/explore/ExploreView'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Ensure root Me entity and its graph_layout exist
  const { data: me } = await supabase.from('entities').select('id').eq('user_id', user.id).eq('name', 'Me').maybeSingle()
  if (!me) {
    const { data: newMe } = await supabase.from('entities').insert({
      user_id: user.id,
      name: 'Me',
      type: 'person',
      aliases: ['me', 'i', 'myself'],
      summary: 'The user'
    }).select('id').single()
    if (newMe) {
      await supabase.from('graph_layout').insert({ entity_id: newMe.id, user_id: user.id, x: 0, y: 0 })
    }
  }

  // Fetch counts for HUD
  const { count: nodeCount } = await supabase.from('entities').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)
  const { count: edgeCount } = await supabase.from('edges').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)

  return <ExploreView nodeCount={nodeCount || 0} edgeCount={edgeCount || 0} />
}
