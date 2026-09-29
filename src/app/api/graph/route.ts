import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateMeEntity } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure root "Me" entity and layout coordinate exist
    const me = await getOrCreateMeEntity(supabase, user.id);
    const { data: meLayout } = await supabase
      .from('graph_layout')
      .select('entity_id')
      .eq('entity_id', me.id)
      .maybeSingle();

    if (!meLayout) {
      await supabase.from('graph_layout').insert({
        entity_id: me.id,
        user_id: user.id,
        x: 0,
        y: 0
      });
    }

    // Fetch graph layouts (nodes)
    const { data: layouts, error: nodesError } = await supabase
      .from('graph_layout')
      .select(`
        x, y,
        entity:entities ( id, name, type )
      `)
      .eq('user_id', user.id);

    if (nodesError) throw nodesError;

    // Fetch edges
    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('src, dst, relation')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (edgesError) throw edgesError;

    const formattedNodes = (layouts || [])
      .filter((n: any) => n.entity)
      .map((n: any) => ({
        id: n.entity.id,
        x: n.x,
        y: n.y,
        label: n.entity.name,
        type: n.entity.type
      }));

    const formattedEdges = (edges || []).map((e: any) => ({
      source: e.src,
      target: e.dst,
      relation: e.relation
    }));

    // Fetch cognitive clusters / themes
    const { data: clusters } = await supabase
      .from('clusters')
      .select('id, name, entity_ids')
      .eq('user_id', user.id);

    // Compute centroid and radius for each cluster from member layout nodes
    const nodeCoords = new Map<string, { x: number; y: number }>();
    (layouts || []).forEach((l: any) => {
      if (l.entity?.id) nodeCoords.set(l.entity.id, { x: l.x, y: l.y });
    });

    const clusterHalos = (clusters || []).map((c: any) => {
      const validPoints = (c.entity_ids || [])
        .map((id: string) => nodeCoords.get(id))
        .filter(Boolean);

      if (validPoints.length === 0) return null;

      const avgX = validPoints.reduce((sum: number, p: any) => sum + p.x, 0) / validPoints.length;
      const avgY = validPoints.reduce((sum: number, p: any) => sum + p.y, 0) / validPoints.length;
      
      let maxDist = 80;
      for (const p of validPoints) {
        const d = Math.hypot(p.x - avgX, p.y - avgY);
        if (d > maxDist) maxDist = d;
      }

      return {
        id: c.id,
        name: c.name,
        x: avgX,
        y: avgY,
        radius: Math.min(450, maxDist + 70)
      };
    }).filter(Boolean);

    return NextResponse.json({
      nodes: formattedNodes,
      edges: formattedEdges,
      clusters: clusterHalos,
      nodeCount: formattedNodes.length,
      edgeCount: formattedEdges.length
    });
  } catch (error: any) {
    console.error('Graph API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

