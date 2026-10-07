/**
 * Cross-Encoder Precision Re-Ranking
 * Uses Xenova/ms-marco-MiniLM-L-6-v2 via @xenova/transformers for sentence-pair cross-encoding.
 * Converts bi-encoder high-recall candidate sets into precision-sorted results.
 */

let tokenizer: any = null;
let model: any = null;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

async function getCrossEncoder(): Promise<{ tokenizer: any; model: any } | null> {
  if (tokenizer && model) return { tokenizer, model };

  try {
    const { AutoTokenizer, AutoModelForSequenceClassification } = await import('@xenova/transformers');
    const modelId = 'Xenova/ms-marco-MiniLM-L-6-v2';

    tokenizer = await AutoTokenizer.from_pretrained(modelId);
    model = await AutoModelForSequenceClassification.from_pretrained(modelId, { quantized: true });

    return { tokenizer, model };
  } catch (err) {
    console.warn('[getCrossEncoder] Failed to load cross-encoder model:', err);
    return null;
  }
}

export async function scoreQueryDocumentPair(query: string, document: string): Promise<number> {
  const encoder = await getCrossEncoder();
  if (!encoder) return 0.5;

  try {
    const inputs = await encoder.tokenizer(query.slice(0, 256), {
      text_pair: document.slice(0, 512),
      padding: true,
      truncation: true
    });

    const output = await encoder.model(inputs);
    const rawLogit = output.logits.data[0];
    return Number(sigmoid(rawLogit).toFixed(4));
  } catch (err) {
    console.warn('[scoreQueryDocumentPair] Error scoring pair:', err);
    return 0.5;
  }
}

export async function rerankCandidates<T>(
  query: string,
  candidates: T[],
  getText: (item: T) => string
): Promise<{ item: T; score: number }[]> {
  if (!query || candidates.length === 0) {
    return candidates.map(item => ({ item, score: 0.5 }));
  }

  const scored: { item: T; score: number }[] = [];

  for (const candidate of candidates) {
    const docText = getText(candidate);
    const score = await scoreQueryDocumentPair(query, docText);
    scored.push({ item: candidate, score });
  }

  return scored.sort((a, b) => b.score - a.score);
}
