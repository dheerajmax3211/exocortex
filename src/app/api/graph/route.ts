import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch graph layouts (nodes)
    const { data: nodes, error: nodesError } = await supabase
      .from('graph_layout')
      .select(`
        x, y, fixed,
        entity:entities ( id, name, type )
      `)
      .eq('user_id', user.id);

    if (nodesError) throw nodesError;

    // Fetch edges
    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('src_id, dst_id, relation')
      .eq('user_id', user.id);

    if (edgesError) throw edgesError;

    return NextResponse.json({
      nodes: nodes || [],
      edges: edges || [],
      nodeCount: nodes?.length || 0,
      edgeCount: edges?.length || 0
    });
  } catch (error: any) {
    console.error('Graph API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
