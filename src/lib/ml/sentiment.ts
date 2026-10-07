/**
 * On-Device Sentiment Grounding Engine
 * Uses Xenova/distilbert-base-uncased-finetuned-sst-2-english via @xenova/transformers.
 * Produces real, inspectable classification confidence for text clauses.
 */

export interface SentimentScore {
  label: 'POSITIVE' | 'NEGATIVE';
  score: number;
}

export interface ClauseSentiment {
  clause: string;
  label: 'POSITIVE' | 'NEGATIVE';
  score: number;
}

let sentimentPipeline: any = null;

export async function scoreSentiment(clause: string): Promise<SentimentScore> {
  const clean = clause?.trim();
  if (!clean) return { label: 'POSITIVE', score: 0.5 };

  try {
    if (!sentimentPipeline) {
      const { pipeline } = await import('@xenova/transformers');
      sentimentPipeline = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
        quantized: true
      });
    }

    const output = await sentimentPipeline(clean.slice(0, 512));
    const first = Array.isArray(output) ? output[0] : output;

    const label = first?.label?.toUpperCase() === 'NEGATIVE' ? 'NEGATIVE' : 'POSITIVE';
    const score = Number((first?.score ?? 0.5).toFixed(4));

    return { label, score };
  } catch (err) {
    console.warn('[scoreSentiment] Sentiment inference error:', err);
    return { label: 'POSITIVE', score: 0.5 };
  }
}

/**
 * Splits raw text into readable semantic clauses/sentences and scores each clause.
 */
export async function scoreEntryClauses(text: string): Promise<ClauseSentiment[]> {
  if (!text || typeof text !== 'string') return [];

  // Split on sentence and major clause boundaries: ., !, ?, ;, or newlines
  const rawClauses = text
    .split(/(?<=[.!?;\n])\s+/)
    .map(c => c.trim().replace(/^[-*•\s]+/, ''))
    .filter(c => c.length > 3);

  const clausesToScore = rawClauses.length > 0 ? rawClauses : [text.trim()];

  const results: ClauseSentiment[] = [];
  for (const clause of clausesToScore.slice(0, 10)) {
    const { label, score } = await scoreSentiment(clause);
    results.push({ clause, label, score });
  }

  return results;
}
