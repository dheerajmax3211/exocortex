/**
 * Entity Resolution & Deduplication Engine (Record Linkage)
 * Uses multi-stage matching:
 * 1. Normalized exact & alias matching (case/punctuation-insensitive)
 * 2. Token Set / Jaro-Winkler & Levenshtein string similarity
 * 3. High-dimensional vector cosine similarity (> 0.90)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { cosineSimilarity } from './graph-analytics';

export interface CandidateEntity {
  id: string;
  name: string;
  type: string;
  aliases?: string[];
  summary?: string | null;
  props?: Record<string, any>;
  embedding?: number[] | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface MatchResult {
  matchedId: string;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy_string' | 'semantic_vector';
  existingEntity: CandidateEntity;
}

/**
 * Normalizes text for comparison: lowercases, removes punctuation, trims spaces.
 */
export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Levenshtein string distance.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Normalized string similarity score between 0.0 and 1.0.
 */
export function stringSimilarity(s1: string, s2: string): number {
  const n1 = normalizeEntityName(s1);
  const n2 = normalizeEntityName(s2);

  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0.0;

  // Direct inclusion check: e.g. "ooty trip" contains "ooty"
  const maxLen = Math.max(n1.length, n2.length);
  const distance = levenshteinDistance(n1, n2);
  const similarity = (maxLen - distance) / maxLen;

  // Token overlap ratio for multi-word phrases (e.g. "trip to ooty" vs "ooty trip")
  const tokens1 = new Set(n1.split(' ').filter(t => t.length > 1));
  const tokens2 = new Set(n2.split(' ').filter(t => t.length > 1));
  let overlap = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) overlap++;
  });
  const tokenJaccard = (tokens1.size + tokens2.size - overlap) > 0
    ? overlap / (tokens1.size + tokens2.size - overlap)
    : 0;

  return Math.max(similarity, tokenJaccard);
}

/**
 * Resolves whether a candidate entity already exists in the graph.
 */
export function resolveEntityMatch(
  newEntity: { name: string; type?: string; aliases?: string[]; embedding?: number[] | null },
  existingEntities: CandidateEntity[]
): MatchResult | null {
  const normNewName = normalizeEntityName(newEntity.name);
  if (!normNewName) return null;

  const newAliases = (newEntity.aliases || []).map(normalizeEntityName);

  for (const existing of existingEntities) {
    const normExistingName = normalizeEntityName(existing.name);
    const existingAliases = (existing.aliases || []).map(normalizeEntityName);

    // 1. Exact Name Match (Normalized)
    if (normNewName === normExistingName) {
      return {
        matchedId: existing.id,
        confidence: 1.0,
        matchType: 'exact',
        existingEntity: existing
      };
    }

    // 2. Alias Match
    if (
      existingAliases.includes(normNewName) ||
      newAliases.includes(normExistingName) ||
      newAliases.some(a => existingAliases.includes(a))
    ) {
      return {
        matchedId: existing.id,
        confidence: 0.98,
        matchType: 'alias',
        existingEntity: existing
      };
    }

    // 3. Type compatibility check for fuzzy matching
    // (Only match similar names if their types are compatible or undefined)
    const typesCompatible = !newEntity.type || !existing.type || newEntity.type === existing.type;

    if (typesCompatible) {
      // Fuzzy string metric
      const sim = stringSimilarity(newEntity.name, existing.name);
      if (sim >= 0.88) {
        return {
          matchedId: existing.id,
          confidence: Math.round(sim * 100) / 100,
          matchType: 'fuzzy_string',
          existingEntity: existing
        };
      }

      // Check fuzzy against aliases
      for (const alias of existingAliases) {
        const aSim = stringSimilarity(normNewName, alias);
        if (aSim >= 0.90) {
          return {
            matchedId: existing.id,
            confidence: Math.round(aSim * 100) / 100,
            matchType: 'fuzzy_string',
            existingEntity: existing
          };
        }
      }
    }

    // 4. Semantic Vector Match (if embeddings available and types match)
    if (typesCompatible && newEntity.embedding && existing.embedding) {
      const vecSim = cosineSimilarity(newEntity.embedding, existing.embedding);
      if (vecSim >= 0.93) {
        return {
          matchedId: existing.id,
          confidence: Math.round(vecSim * 100) / 100,
          matchType: 'semantic_vector',
          existingEntity: existing
        };
      }
    }
  }

  return null;
}

/**
 * High-recall candidate retrieval from database for ingest prompt injection.
 * Fetches:
 * 1. Semantic nearest neighbors via pgvector or fallback text search
 * 2. Case-insensitive exact & trigram matches for all tokens in the input text
 * 3. 1-hop relational neighborhood of all seeds
 * 4. Recent entities (last 20)
 */
export async function retrieveHighRecallCandidates(
  supabase: SupabaseClient,
  userId: string,
  rawText: string
): Promise<CandidateEntity[]> {
  const candidateMap = new Map<string, CandidateEntity>();

  // Tokenize text into words (length >= 3), lowercase, remove common stopwords
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'were', 'been',
    'will', 'would', 'could', 'should', 'about', 'into', 'some', 'what', 'when',
    'where', 'which', 'their', 'there', 'they'
  ]);

  const rawTokens = rawText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  const uniqueTokens = Array.from(new Set(rawTokens));

  // Also include 2-word sliding n-grams (e.g. "ooty trip", "nikon z50", "budget tracking")
  const bigrams: string[] = [];
  for (let i = 0; i < rawTokens.length - 1; i++) {
    bigrams.push(`${rawTokens[i]} ${rawTokens[i + 1]}`);
  }

  // 1. Text & Trigram search for tokens and bigrams (case-insensitive)
  const searchQueries = [...uniqueTokens.slice(0, 15), ...bigrams.slice(0, 8)];
  for (const q of searchQueries) {
    const { data: matches } = await supabase.rpc('search_entities', {
      p_query: q,
      p_user_id: userId
    });

    if (matches) {
      for (const m of matches) {
        if (!candidateMap.has(m.id)) {
          candidateMap.set(m.id, {
            id: m.id,
            name: m.name,
            type: m.type,
            aliases: m.aliases || [],
            summary: m.summary,
            props: m.props || {},
            start_date: m.start_date,
            end_date: m.end_date
          });
        }
      }
    }
  }

  // 2. Direct ILIKE query against entities table to catch lowercase variations
  for (const token of uniqueTokens.slice(0, 10)) {
    const { data: directMatches } = await supabase
      .from('entities')
      .select('id, name, type, aliases, summary, props, start_date, end_date')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or(`name.ilike.%${token}%,aliases.cs.{${token}}`)
      .limit(5);

    if (directMatches) {
      for (const dm of directMatches) {
        if (!candidateMap.has(dm.id)) {
          candidateMap.set(dm.id, dm);
        }
      }
    }
  }

  // 3. Fetch recently touched entities (last 25 entities)
  const { data: recentEntities } = await supabase
    .from('entities')
    .select('id, name, type, aliases, summary, props, start_date, end_date')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(25);

  if (recentEntities) {
    for (const re of recentEntities) {
      if (!candidateMap.has(re.id)) {
        candidateMap.set(re.id, re);
      }
    }
  }

  // 4. 1-hop relational expansion for matched seed entities
  const seedIds = Array.from(candidateMap.keys()).slice(0, 10);
  if (seedIds.length > 0) {
    const { data: neighborEdges } = await supabase
      .from('edges')
      .select('src, dst')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or(`src.in.(${seedIds.join(',')}),dst.in.(${seedIds.join(',')})`)
      .limit(30);

    const neighborIds = new Set<string>();
    (neighborEdges || []).forEach(edge => {
      if (!candidateMap.has(edge.src)) neighborIds.add(edge.src);
      if (!candidateMap.has(edge.dst)) neighborIds.add(edge.dst);
    });

    if (neighborIds.size > 0) {
      const { data: neighbors } = await supabase
        .from('entities')
        .select('id, name, type, aliases, summary, props, start_date, end_date')
        .eq('user_id', userId)
        .in('id', Array.from(neighborIds).slice(0, 20));

      if (neighbors) {
        for (const n of neighbors) {
          candidateMap.set(n.id, n);
        }
      }
    }
  }

  return Array.from(candidateMap.values());
}
