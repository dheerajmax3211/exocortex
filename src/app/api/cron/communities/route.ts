import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    let { data: { user } } = await supabase.auth.getUser();

    const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;

    if (!user && isCron) {
      const url = new URL(req.url);
      const queryUserId = url.searchParams.get('user_id');
      if (queryUserId) {
        user = { id: queryUserId } as any;
      } else {
        // Run for the first active user if not specified
        const { data: users } = await supabase.from('entities').select('user_id').limit(1);
        if (users && users.length > 0) {
          user = { id: users[0].user_id } as any;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch active edges for user
    const { data: edges, error: edgeError } = await supabase
      .from('edges')
      .select('src, dst, relation')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (edgeError) {
      return NextResponse.json({ error: 'Failed to fetch edges: ' + edgeError.message }, { status: 500 });
    }

    if (!edges || edges.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No edges found to cluster',
        communities_count: 0,
        modularity: 0
      });
    }

    // Build Graphology undirected graph
    const graph = new Graph({ type: 'undirected', multi: false });

    for (const edge of edges) {
      if (!edge.src || !edge.dst || edge.src === edge.dst) continue;

      if (!graph.hasNode(edge.src)) graph.addNode(edge.src);
      if (!graph.hasNode(edge.dst)) graph.addNode(edge.dst);

      if (!graph.hasEdge(edge.src, edge.dst)) {
        graph.addEdge(edge.src, edge.dst, { relation: edge.relation });
      }
    }

    if (graph.order === 0 || graph.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'Graph has no connected components',
        communities_count: 0,
        modularity: 0
      });
    }

    // Run Louvain Community Detection (Blondel et al.)
    const details = louvain.detailed(graph);
    const modularity = details.modularity || 0;
    const communities = details.communities || {};

    const recordsToUpsert = Object.entries(communities).map(([entityId, communityId]) => ({
      entity_id: entityId,
      community_id: communityId,
      modularity: Number(modularity.toFixed(6)),
      updated_at: new Date().toISOString()
    }));

    // Upsert into entity_communities table (graceful if table unapplied)
    try {
      const { error: upsertErr } = await supabase
        .from('entity_communities')
        .upsert(recordsToUpsert, { onConflict: 'entity_id' });

      if (upsertErr) {
        console.warn('[cron/communities] Table entity_communities write failed (migration may be pending):', upsertErr.message);
      }
    } catch (dbErr) {
      console.warn('[cron/communities] entity_communities write exception:', dbErr);
    }

    return NextResponse.json({
      success: true,
      node_count: graph.order,
      edge_count: graph.size,
      communities_count: details.count,
      modularity: Number(modularity.toFixed(6)),
      community_distribution: Object.values(communities).reduce((acc: Record<string, number>, c: any) => {
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {})
    });
  } catch (error: any) {
    console.error('Community detection error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
