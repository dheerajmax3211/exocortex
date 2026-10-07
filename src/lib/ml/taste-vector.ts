/**
 * Vector-Based Taste Profile & Personalized Re-Ranking
 * Reuses the local 384-dim all-MiniLM-L6-v2 embeddings to compute rating-weighted taste vectors.
 * Grounded strictly in the user's logged ratings >= 7/10.
 */

import { getEmbedding } from '@/lib/embeddings';

export interface RatedItem {
  id: string;
  name: string;
  rating: number; // normalized scale 1-10
  embedding?: number[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Computes a normalized taste vector from rated items (rating >= 7/10).
 * Taste Vector = (sum of r_i * v_i) / ||sum||
 */
export async function computeTasteVectorFromItems(items: RatedItem[]): Promise<number[] | null> {
  const eligible = items.filter(it => it.rating >= 7);
  if (eligible.length === 0) return null;

  const dim = 384;
  const weightedSum = new Array(dim).fill(0);
  let totalWeight = 0;

  for (const item of eligible) {
    let emb = item.embedding;
    if (!emb || emb.length !== dim) {
      emb = await getEmbedding(item.name);
    }
    const weight = item.rating;
    totalWeight += weight;
    for (let i = 0; i < dim; i++) {
      weightedSum[i] += emb[i] * weight;
    }
  }

  if (totalWeight === 0) return null;

  // Normalize to unit length
  const norm = Math.sqrt(weightedSum.reduce((acc, val) => acc + val * val, 0)) || 1;
  return weightedSum.map(v => Number((v / norm).toFixed(6)));
}

/**
 * Computes the taste vector for a specific entity category directly from the database.
 */
export async function computeCategoryTasteVector(
  supabase: any,
  userId: string,
  categoryType: string
): Promise<number[] | null> {
  try {
    // 1. Fetch entities matching category
    const { data: entities } = await supabase
      .from('entities')
      .select('id, name, props, embedding')
      .eq('user_id', userId)
      .eq('type', categoryType)
      .is('deleted_at', null);

    if (!entities || entities.length === 0) return null;

    // 2. Fetch rating facts for these entities
    const entityIds = entities.map((e: any) => e.id);
    const { data: facts } = await supabase
      .from('facts')
      .select('entity_id, key, value')
      .in('entity_id', entityIds)
      .in('key', ['rating_10', 'rating', 'score', 'user_rating']);

    const ratingMap = new Map<string, number>();
    for (const f of (facts || [])) {
      const parsed = parseFloat(f.value);
      if (!isNaN(parsed)) {
        ratingMap.set(f.entity_id, parsed);
      }
    }

    const items: RatedItem[] = [];
    for (const ent of entities) {
      const explicitRating = ratingMap.get(ent.id);
      const propRating = typeof ent.props?.rating === 'number' ? ent.props.rating : undefined;
      const finalRating = explicitRating ?? propRating;

      if (finalRating !== undefined && finalRating >= 7) {
        items.push({
          id: ent.id,
          name: ent.name,
          rating: finalRating,
          embedding: ent.embedding
        });
      }
    }

    return await computeTasteVectorFromItems(items);
  } catch (err) {
    console.warn('[computeCategoryTasteVector] Error computing taste vector:', err);
    return null;
  }
}

/**
 * Re-ranks candidate suggestions by cosine similarity against the computed taste vector.
 */
export async function rerankByTasteVector<T extends { name: string; embedding?: number[] }>(
  candidates: T[],
  tasteVector: number[] | null
): Promise<{ item: T; similarity: number }[]> {
  if (!tasteVector || tasteVector.length !== 384 || candidates.length === 0) {
    return candidates.map(item => ({ item, similarity: 0 }));
  }

  const scored: { item: T; similarity: number }[] = [];

  for (const candidate of candidates) {
    let emb = candidate.embedding;
    if (!emb || emb.length !== 384) {
      emb = await getEmbedding(candidate.name);
    }
    const sim = cosineSimilarity(emb, tasteVector);
    scored.push({
      item: candidate,
      similarity: Number(sim.toFixed(4))
    });
  }

  return scored.sort((a, b) => b.similarity - a.similarity);
}
