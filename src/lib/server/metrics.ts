export interface MetricsStore {
  // Extraction quality
  extraction_entity_count: number[];  // entities per extraction
  extraction_edge_count: number[];    // edges per extraction
  extraction_fact_count: number[];    // facts per extraction
  extraction_question_count: number[];// clarification questions per extraction
  
  // Latency (milliseconds)
  ingest_total_ms: number[];          // total ingestion time
  candidate_retrieval_ms: number[];   // candidate lookup time
  llm_extraction_ms: number[];        // LLM call time
  commit_total_ms: number[];          // total commit time
  graph_write_ms: number[];           // DB write time
  embedding_gen_ms: number[];         // embedding generation time
  
  // Reliability
  extraction_success_count: number;
  extraction_failure_count: number;
  commit_success_count: number;
  commit_failure_count: number;
  commit_retry_count: number;
  
  // Entity resolution
  entity_match_exact: number;
  entity_match_alias: number;
  entity_match_fuzzy: number;
  entity_match_semantic: number;
  entity_match_new: number;           // no match found, new entity created
  entity_match_ambiguous: number;     // ambiguous, needed clarification
}

const defaultStore: MetricsStore = {
  extraction_entity_count: [],
  extraction_edge_count: [],
  extraction_fact_count: [],
  extraction_question_count: [],
  ingest_total_ms: [],
  candidate_retrieval_ms: [],
  llm_extraction_ms: [],
  commit_total_ms: [],
  graph_write_ms: [],
  embedding_gen_ms: [],
  extraction_success_count: 0,
  extraction_failure_count: 0,
  commit_success_count: 0,
  commit_failure_count: 0,
  commit_retry_count: 0,
  entity_match_exact: 0,
  entity_match_alias: 0,
  entity_match_fuzzy: 0,
  entity_match_semantic: 0,
  entity_match_new: 0,
  entity_match_ambiguous: 0,
};

let store: MetricsStore = { ...defaultStore };

export function recordMetric(name: keyof MetricsStore, value: number) {
  const current = store[name];
  if (Array.isArray(current)) {
    (store[name] as number[]).push(value);
  } else {
    (store[name] as number) = value;
  }
}

export function incrementCounter(name: keyof MetricsStore) {
  const current = store[name];
  if (typeof current === 'number') {
    (store[name] as number) += 1;
  }
}

function calculatePercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  if (Math.floor(index) === index) {
    return sorted[index];
  }
  const i = Math.floor(index);
  const fraction = index - i;
  return sorted[i] + (sorted[i + 1] - sorted[i]) * fraction;
}

export function getMetricsSummary() {
  const summary: Record<string, any> = {};
  for (const [key, val] of Object.entries(store)) {
    if (Array.isArray(val)) {
      if (val.length === 0) {
        summary[key] = { count: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
      } else {
        const sum = val.reduce((acc, v) => acc + v, 0);
        summary[key] = {
          count: val.length,
          mean: sum / val.length,
          p50: calculatePercentile(val, 50),
          p95: calculatePercentile(val, 95),
          p99: calculatePercentile(val, 99),
        };
      }
    } else {
      summary[key] = val;
    }
  }
  return summary;
}

export function resetMetrics() {
  store = { 
    ...defaultStore,
    extraction_entity_count: [],
    extraction_edge_count: [],
    extraction_fact_count: [],
    extraction_question_count: [],
    ingest_total_ms: [],
    candidate_retrieval_ms: [],
    llm_extraction_ms: [],
    commit_total_ms: [],
    graph_write_ms: [],
    embedding_gen_ms: []
  };
}
