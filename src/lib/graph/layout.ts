import { SupabaseClient } from '@supabase/supabase-js';
import { getLayout, upsertLayout } from '@/lib/db';
import * as d3 from 'd3-force';

export async function placeNewEntity(supabase: SupabaseClient, entityId: string, edges: any[], userId: string) {
  // Find connected neighbors that have a layout
  const neighborIds = edges
    .map(e => (e.src === entityId ? e.dst : e.src))
    .filter(id => id && id !== entityId);
    
  let placed = false;

  if (neighborIds.length > 0) {
    // try placing near most connected or first neighbor
    for (const nid of neighborIds) {
      const layout = await getLayout(supabase, nid);
      if (layout) {
        await upsertLayout(supabase, {
          entity_id: entityId,
          user_id: userId,
          x: layout.x + (Math.random() * 20 - 10),
          y: layout.y + (Math.random() * 20 - 10)
        });
        placed = true;
        break;
      }
    }
  }

  if (!placed) {
    // isolated or no neighbors have layout, place random
    await upsertLayout(supabase, {
      entity_id: entityId,
      user_id: userId,
      x: Math.random() * 500 - 250,
      y: Math.random() * 500 - 250
    });
  }

  if (placed && neighborIds.length > 0) {
    await runLocalRelaxation(supabase, entityId, neighborIds, userId);
  }
}

export async function runLocalRelaxation(supabase: SupabaseClient, entityId: string, neighborIds: string[], userId: string) {
  // fetch layouts for node and neighbors
  const layouts: Record<string, any> = {};
  
  const selfLayout = await getLayout(supabase, entityId);
  if (!selfLayout) return;
  layouts[entityId] = { id: entityId, x: selfLayout.x, y: selfLayout.y, fx: null, fy: null };

  for (const nid of neighborIds) {
    const l = await getLayout(supabase, nid);
    if (l) {
      // Fix neighbors in place
      layouts[nid] = { id: nid, x: l.x, y: l.y, fx: l.x, fy: l.y };
    }
  }

  const nodes = Object.values(layouts);
  const links = neighborIds.filter(nid => layouts[nid]).map(nid => ({
    source: entityId,
    target: nid
  }));

  if (links.length === 0) return;

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d: any) => d.id).distance(30))
    .force('charge', d3.forceManyBody().strength(-100))
    .stop();

  // Run a few ticks
  for (let i = 0; i < 30; ++i) {
    simulation.tick();
  }

  const newPos = nodes.find((n: any) => n.id === entityId);
  if (newPos) {
    await upsertLayout(supabase, {
      entity_id: entityId,
      user_id: userId,
      x: newPos.x,
      y: newPos.y
    });
  }
}
