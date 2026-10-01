/**
 * Graph Data Science & Network Analytics Engine
 * Provides PageRank centrality, degree centrality, bridge node detection,
 * and semantic-augmented community clustering.
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface AnalyticsNode {
  id: string;
  name: string;
  type: string;
  embedding?: number[] | null;
}

export interface AnalyticsEdge {
  src: string;
  dst: string;
  relation?: string;
  weight?: number;
}

export interface GraphCentralityScores {
  pageRank: Map<string, number>;
  normalizedScores: Map<string, number>; // 1.0 to 10.0 scale
  degreeCentrality: Map<string, number>;
  bridgeNodes: Set<string>;
}

/**
 * Computes PageRank centrality for all nodes in the knowledge graph.
 * PR(u) = (1 - d) / N + d * SUM_{v in In(u)} (PR(v) / Out(v))
 * 
 * @param nodeIds List of entity IDs
 * @param edges Directed/relational edges
 * @param dampingFactor Damping factor (default 0.85)
 * @param maxIterations Iteration budget
 * @param tolerance Convergence epsilon
 */
export function calculatePageRank(
  nodeIds: string[],
  edges: AnalyticsEdge[],
  dampingFactor = 0.85,
  maxIterations = 50,
  tolerance = 1e-5
): Map<string, number> {
  const N = nodeIds.length;
  if (N === 0) return new Map();

  const rank = new Map<string, number>();
  const initialRank = 1.0 / N;
  nodeIds.forEach(id => rank.set(id, initialRank));

  // Build adjacency: out-degree and incoming neighbors
  const outDegree = new Map<string, number>();
  const inNeighbors = new Map<string, string[]>();

  nodeIds.forEach(id => {
    outDegree.set(id, 0);
    inNeighbors.set(id, []);
  });

  edges.forEach(edge => {
    if (outDegree.has(edge.src) && inNeighbors.has(edge.dst)) {
      outDegree.set(edge.src, (outDegree.get(edge.src) || 0) + 1);
      inNeighbors.get(edge.dst)!.push(edge.src);
    }
  });

  // Power iteration
  for (let iter = 0; iter < maxIterations; iter++) {
    const nextRank = new Map<string, number>();
    let diff = 0;

    // Distribute dangling node ranks (nodes with outDegree = 0)
    let danglingSum = 0;
    nodeIds.forEach(id => {
      if ((outDegree.get(id) || 0) === 0) {
        danglingSum += rank.get(id) || 0;
      }
    });

    const danglingContribution = (dampingFactor * danglingSum) / N;
    const baseVal = (1.0 - dampingFactor) / N + danglingContribution;

    nodeIds.forEach(u => {
      let incomingSum = 0;
      const predecessors = inNeighbors.get(u) || [];
      for (const v of predecessors) {
        const outDeg = outDegree.get(v) || 1;
        incomingSum += (rank.get(v) || 0) / outDeg;
      }

      const newPR = baseVal + dampingFactor * incomingSum;
      nextRank.set(u, newPR);
      diff += Math.abs(newPR - (rank.get(u) || 0));
    });

    // Update ranks
    nextRank.forEach((val, id) => rank.set(id, val));

    if (diff < tolerance) {
      break;
    }
  }

  return rank;
}

/**
 * Computes cosine similarity between two vectors.
 */
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
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Full Graph Data Science pipeline: Centrality, Degree, and Bridge Detection.
 */
export function analyzeKnowledgeGraph(
  nodes: AnalyticsNode[],
  edges: AnalyticsEdge[]
): GraphCentralityScores {
  const nodeIds = nodes.map(n => n.id);
  const pageRank = calculatePageRank(nodeIds, edges);

  // Compute degree centrality
  const degreeCentrality = new Map<string, number>();
  nodeIds.forEach(id => degreeCentrality.set(id, 0));

  edges.forEach(e => {
    degreeCentrality.set(e.src, (degreeCentrality.get(e.src) || 0) + 1);
    degreeCentrality.set(e.dst, (degreeCentrality.get(e.dst) || 0) + 1);
  });

  // Normalize PageRank to 1.0 - 10.0 scale for visual node sizing
  let minPR = Infinity;
  let maxPR = -Infinity;
  pageRank.forEach(pr => {
    if (pr < minPR) minPR = pr;
    if (pr > maxPR) maxPR = pr;
  });

  const normalizedScores = new Map<string, number>();
  const prRange = maxPR - minPR || 1;

  nodeIds.forEach(id => {
    const raw = pageRank.get(id) || minPR;
    // Map to 1.5 - 9.0 range
    const normalized = 1.5 + ((raw - minPR) / prRange) * 7.5;
    normalizedScores.set(id, Math.round(normalized * 10) / 10);
  });

  // Detect bridge nodes: entities with high degree connecting diverse types
  const bridgeNodes = new Set<string>();
  const neighborTypes = new Map<string, Set<string>>();
  const nodeTypeMap = new Map(nodes.map(n => [n.id, n.type]));

  nodeIds.forEach(id => neighborTypes.set(id, new Set()));

  edges.forEach(e => {
    const srcType = nodeTypeMap.get(e.src);
    const dstType = nodeTypeMap.get(e.dst);
    if (srcType && dstType) {
      neighborTypes.get(e.src)?.add(dstType);
      neighborTypes.get(e.dst)?.add(srcType);
    }
  });

  neighborTypes.forEach((types, id) => {
    // If a node connects 3 or more distinct entity types (e.g. person, place, tech, period)
    if (types.size >= 3) {
      bridgeNodes.add(id);
    }
  });

  return {
    pageRank,
    normalizedScores,
    degreeCentrality,
    bridgeNodes
  };
}

/**
 * Hybrid Graph Data Science pipeline.
 * Attempts to use high-performance Postgres RPC, falls back to in-memory processing.
 */
export async function analyzeKnowledgeGraphHybrid(
  supabase: SupabaseClient,
  userId: string,
  nodes: AnalyticsNode[],
  edges: AnalyticsEdge[]
): Promise<GraphCentralityScores> {
  try {
    const { data, error } = await supabase.rpc('compute_graph_centrality', { p_user_id: userId });
    
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("No data returned from RPC, falling back to memory");
    }

    const pageRank = new Map<string, number>();
    const normalizedScores = new Map<string, number>();
    const degreeCentrality = new Map<string, number>();
    const bridgeNodes = new Set<string>();

    for (const row of data) {
      pageRank.set(row.id, row.page_rank);
      normalizedScores.set(row.id, row.normalized_score);
      degreeCentrality.set(row.id, row.degree_centrality);
      if (row.is_bridge) bridgeNodes.add(row.id);
    }

    return {
      pageRank,
      normalizedScores,
      degreeCentrality,
      bridgeNodes
    };
  } catch (e) {
    console.warn("RPC compute_graph_centrality failed, falling back to in-memory implementation.", e);
    return analyzeKnowledgeGraph(nodes, edges);
  }
}
