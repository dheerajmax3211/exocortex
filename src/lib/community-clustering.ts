import { SupabaseClient } from '@supabase/supabase-js';
import { getEmbedding } from './embeddings';
import { chatJSON } from './llm';
import { z } from 'zod';

interface CommunityCluster {
  communityId: number;
  entityIds: string[];
}

/**
 * Pure TypeScript Label-Propagation community detection algorithm.
 * Groups graph entities into densely connected cognitive clusters.
 */
export function detectCommunities(
  entities: { id: string; name: string; type: string }[],
  edges: { src: string; dst: string }[]
): CommunityCluster[] {
  if (entities.length === 0) return [];

  const labels = new Map<string, number>();
  const neighbors = new Map<string, string[]>();

  // Initialize each node with its own unique label
  entities.forEach((ent, idx) => {
    labels.set(ent.id, idx);
    neighbors.set(ent.id, []);
  });

  // Populate adjacency list
  for (const edge of edges) {
    if (neighbors.has(edge.src) && neighbors.has(edge.dst)) {
      neighbors.get(edge.src)!.push(edge.dst);
      neighbors.get(edge.dst)!.push(edge.src);
    }
  }

  // Run 5 iterations of label propagation
  for (let iter = 0; iter < 5; iter++) {
    for (const ent of entities) {
      const nList = neighbors.get(ent.id) || [];
      if (nList.length === 0) continue;

      // Count label frequencies among neighbors
      const freq = new Map<number, number>();
      for (const nId of nList) {
        const l = labels.get(nId)!;
        freq.set(l, (freq.get(l) || 0) + 1);
      }

      // Pick dominant neighbor label
      let maxCount = -1;
      let dominantLabel = labels.get(ent.id)!;
      for (const [l, count] of freq.entries()) {
        if (count > maxCount) {
          maxCount = count;
          dominantLabel = l;
        }
      }
      labels.set(ent.id, dominantLabel);
    }
  }

  // Group entities by label
  const groups = new Map<number, string[]>();
  for (const [entId, label] of labels.entries()) {
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entId);
  }

  // Filter out singleton clusters (keep communities of 2 or more nodes)
  const communities: CommunityCluster[] = [];
  for (const [communityId, entityIds] of groups.entries()) {
    if (entityIds.length >= 2) {
      communities.push({ communityId, entityIds });
    }
  }

  return communities;
}

/**
 * Re-clusters the user's graph and persists Cognitive Themes to the `clusters` table.
 */
export async function updateCognitiveClusters(supabase: SupabaseClient, userId: string) {
  try {
    // 1. Fetch all user entities & active edges
    const { data: entities } = await supabase
      .from('entities')
      .select('id, name, type, summary')
      .eq('user_id', userId)
      .is('deleted_at', null);

    const { data: edges } = await supabase
      .from('edges')
      .select('src, dst')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!entities || entities.length < 3) return;

    // 2. Detect graph communities
    const communities = detectCommunities(entities, edges || []);
    if (communities.length === 0) return;

    const entMap = new Map(entities.map(e => [e.id, e]));

    // 3. For each significant community (top 5), generate high-order theme
    for (const comm of communities.slice(0, 5)) {
      const memberEntities = comm.entityIds.map(id => entMap.get(id)).filter(Boolean);
      const names = memberEntities.map(e => `${e!.name} (${e!.type})`).join(', ');

      const themeSchema = z.object({
        theme_name: z.string(),
        summary: z.string()
      });

      const prompt = `Entities grouped by dense connections in user's memory graph: [${names}].
Synthesize this into a high-level "Cognitive Theme" representing a living aspect of the user's life, taste, or social circle (e.g. "Weekend Craft Beer & Social Haunts", "Existential Sci-Fi Cinema Obsession", "College Computer Science Circle").`;

      try {
        const theme = await chatJSON({
          system: 'You synthesize personal knowledge graph communities into cognitive themes. Respond in JSON.',
          prompt,
          schema: themeSchema,
          temperature: 0.3
        });

        const embedding = await getEmbedding(`${theme.theme_name}: ${theme.summary}`);

        // Upsert into clusters table
        await supabase.from('clusters').insert({
          user_id: userId,
          name: theme.theme_name,
          summary: theme.summary,
          entity_ids: comm.entityIds,
          embedding
        });
      } catch (e) {
        console.warn('Cluster synthesis skipped for community:', e);
      }
    }
  } catch (err) {
    console.error('Failed to update cognitive clusters:', err);
  }
}
