import { SupabaseClient } from '@supabase/supabase-js';
import { getEmbedding } from './embeddings';

export interface HybridGraphResult {
  seeds: any[];
  edges: any[];
  neighbors: any[];
  facts: any[];
  clusters: any[];
  latencyMs: number;
}

/**
 * Executes sub-50ms Hybrid GraphRAG search combining vector cosine search
 * with 1-hop relational topology expansion in a single SQL call.
 */
export async function executeHybridGraphRAG(
  query: string,
  supabase: SupabaseClient,
  matchCount: number = 8
): Promise<HybridGraphResult> {
  const startTime = Date.now();

  try {
    // 1. Generate local 384-dim vector embedding (<20ms)
    const queryVector = await getEmbedding(query);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { seeds: [], edges: [], neighbors: [], facts: [], clusters: [], latencyMs: 0 };
    }

    // 2. Single-shot hybrid SQL search (<30ms)
    const { data, error } = await supabase.rpc('hybrid_graph_search', {
      p_query_embedding: queryVector,
      p_user_id: user.id,
      p_match_count: matchCount,
      p_similarity_threshold: 0.15
    });

    if (error || !data) {
      // Fallback if migration 003 not yet applied in Supabase dashboard
      return await executeFallbackSearch(query, supabase, startTime);
    }

    let seeds = data.seeds || [];
    const seedIds = seeds.map((s: any) => s.id);
    let facts = data.facts || [];

    // Prioritize seed facts so they are NEVER crowded out by neighbor/root entity facts
    if (seedIds.length > 0) {
      const { data: seedFacts } = await supabase
        .from('facts')
        .select('id, entity_id, key, value')
        .in('entity_id', seedIds)
        .is('invalidated_at', null)
        .limit(30);

      if (seedFacts && seedFacts.length > 0) {
        const seedFactIds = new Set(seedFacts.map(f => f.id));
        facts = [...seedFacts, ...facts.filter((f: any) => !seedFactIds.has(f.id))];
      }
    }

    // Cross-encoder precision rerank on retrieved seeds against literal query
    if (seeds.length > 2) {
      try {
        const { rerankCandidates } = await import('./ml/rerank');
        const reranked = await rerankCandidates(
          query,
          seeds,
          (s: any) => `${s.name} (${s.type || ''}): ${s.summary || ''}`
        );
        seeds = reranked.map(r => r.item);
      } catch (rerankErr) {
        console.warn('[executeHybridGraphRAG] Cross-encoder rerank skipped:', rerankErr);
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      seeds,
      edges: data.edges || [],
      neighbors: data.neighbors || [],
      facts,
      clusters: data.clusters || [],
      latencyMs
    };
  } catch (err) {
    console.warn('Hybrid GraphRAG error, using fallback:', err);
    return await executeFallbackSearch(query, supabase, startTime);
  }
}

/**
 * Graceful fallback using text and neighborhood search if pgvector RPC is pending.
 */
async function executeFallbackSearch(
  query: string,
  supabase: SupabaseClient,
  startTime: number
): Promise<HybridGraphResult> {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Try exact sentence first, then word-level matches
  let seeds: any[] = [];
  const { data: matches } = await supabase.rpc('search_entities', {
    p_query: query,
    p_user_id: user?.id
  });
  if (matches && matches.length > 0) {
    seeds.push(...matches.slice(0, 6));
  } else {
    // Search by key nouns/words
    const words = query.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    for (const word of words.slice(0, 4)) {
      const { data: wordMatches } = await supabase.rpc('search_entities', {
        p_query: word,
        p_user_id: user?.id
      });
      if (wordMatches && wordMatches.length > 0) {
        seeds.push(...wordMatches.slice(0, 3));
      }
    }
    const seen = new Set();
    seeds = seeds.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    }).slice(0, 6);
  }

  const seedIds = seeds.map((s: any) => s.id);

  let edges: any[] = [];
  let facts: any[] = [];
  let neighbors: any[] = [];

  if (seedIds.length > 0) {
    const { data: edgeData } = await supabase
      .from('edges')
      .select('src, dst, relation, props, occurred_on')
      .or(`src.in.(${seedIds.join(',')}),dst.in.(${seedIds.join(',')})`)
      .limit(20);
    edges = edgeData || [];

    const { data: factData } = await supabase
      .from('facts')
      .select('entity_id, key, value')
      .in('entity_id', seedIds)
      .limit(20);
    facts = factData || [];
  }

  // Cross-encoder precision rerank on fallback seeds against literal query
  if (seeds.length > 2) {
    try {
      const { rerankCandidates } = await import('./ml/rerank');
      const reranked = await rerankCandidates(
        query,
        seeds,
        (s: any) => `${s.name} (${s.type || ''}): ${s.summary || ''}`
      );
      seeds = reranked.map(r => r.item);
    } catch (rerankErr) {
      console.warn('[executeFallbackSearch] Cross-encoder rerank skipped:', rerankErr);
    }
  }

  return {
    seeds,
    edges,
    neighbors,
    facts,
    clusters: [],
    latencyMs: Date.now() - startTime
  };
}

/**
 * Formats a Hybrid GraphRAG result into a dense, high-signal prompt context
 * for the LLM reasoning layer.
 */
export function formatGraphRAGContext(ragResult: HybridGraphResult): string {
  const parts: string[] = [];

  const entityNameMap = new Map<string, string>();
  [...ragResult.seeds, ...ragResult.neighbors].forEach(e => {
    if (e.id && e.name) entityNameMap.set(e.id, e.name);
  });

  if (ragResult.clusters.length > 0) {
    parts.push(`🧠 ACTIVE COGNITIVE THEMES:\n${ragResult.clusters.map(c => `- ${c.name}: ${c.summary}`).join('\n')}`);
  }

  if (ragResult.seeds.length > 0) {
    parts.push(`📍 RELEVANT MEMORY NODES:\n${ragResult.seeds.map(s => `- ${s.name} (${s.type}): ${s.summary || JSON.stringify(s.props || {})}`).join('\n')}`);
  }

  if (ragResult.edges.length > 0) {
    parts.push(`🔗 CONNECTED RELATIONSHIPS:\n${ragResult.edges.map(e => `- Relation: ${e.relation} (props: ${JSON.stringify(e.props || {})}, date: ${e.occurred_on || e.valid_from || 'unspecified'})`).join('\n')}`);
  }

  if (ragResult.facts.length > 0) {
    parts.push(`📋 KEY FACTS:\n${ragResult.facts.slice(0, 30).map(f => {
      const entName = entityNameMap.get(f.entity_id);
      return entName ? `- [${entName}] ${f.key}: ${f.value}` : `- ${f.key}: ${f.value}`;
    }).join('\n')}`);
  }

  return parts.join('\n\n');
}
