import { SupabaseClient } from '@supabase/supabase-js';

/**
 * GNN Topology Module
 * Simulates a Graph Convolutional Network (GCN) message-passing layer locally in TypeScript,
 * calculating Link Prediction probabilities by aggregating neighbor embeddings (topological structure)
 * alongside semantic text embeddings.
 */


export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface GCNNode {
  id: string;
  embedding: number[];
  neighbors: string[];
}

// 1. Message Passing (Graph Convolution)
export function computeTopologicalEmbedding(
  nodeId: string, 
  graph: Map<string, GCNNode>
): number[] | null {
  const node = graph.get(nodeId);
  if (!node || !node.embedding) return null;

  const dims = node.embedding.length;
  const aggregated = new Array(dims).fill(0);
  
  let validNeighbors = 0;
  for (const neighborId of node.neighbors) {
    const neighbor = graph.get(neighborId);
    if (neighbor && neighbor.embedding) {
      validNeighbors++;
      for (let i = 0; i < dims; i++) {
        aggregated[i] += neighbor.embedding[i];
      }
    }
  }

  // If no neighbors, the topological embedding is just the semantic embedding
  if (validNeighbors === 0) return node.embedding;

  // Average the neighborhood embeddings
  for (let i = 0; i < dims; i++) {
    aggregated[i] /= validNeighbors;
  }

  // Blend: 50% semantic (self), 50% topological (neighborhood context)
  const blended = new Array(dims);
  for (let i = 0; i < dims; i++) {
    blended[i] = (node.embedding[i] * 0.5) + (aggregated[i] * 0.5);
  }

  return blended;
}

// 2. Predictive Branching (Link Prediction)
export async function predictMissingLinks(
  supabase: SupabaseClient,
  userId: string,
  targetNodeId: string,
  threshold: number = 0.90
): Promise<{ id: string; name: string; probability: number }[]> {
  // Fetch active graph topology
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name, embedding')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .not('embedding', 'is', null);

  const { data: edges } = await supabase
    .from('edges')
    .select('src, dst')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (!entities || !edges) return [];

  const graph = new Map<string, GCNNode>();
  entities.forEach(e => {
    graph.set(e.id, { id: e.id, embedding: JSON.parse(e.embedding), neighbors: [] });
  });

  edges.forEach(e => {
    if (graph.has(e.src) && graph.has(e.dst)) {
      graph.get(e.src)!.neighbors.push(e.dst);
      graph.get(e.dst)!.neighbors.push(e.src);
    }
  });

  const targetTopo = computeTopologicalEmbedding(targetNodeId, graph);
  if (!targetTopo) return [];

  const targetNode = graph.get(targetNodeId);
  const existingNeighbors = new Set(targetNode?.neighbors || []);

  const predictions = [];

  for (const [id, node] of graph.entries()) {
    if (id === targetNodeId || existingNeighbors.has(id)) continue;
    
    const candidateTopo = computeTopologicalEmbedding(id, graph);
    if (!candidateTopo) continue;

    // Link probability based on GCN topological similarity
    const prob = cosineSimilarity(targetTopo, candidateTopo);
    if (prob >= threshold) {
      const entityData = entities.find(e => e.id === id);
      if (entityData) {
        predictions.push({ id, name: entityData.name, probability: prob });
      }
    }
  }

  return predictions.sort((a, b) => b.probability - a.probability);
}
