/**
 * On-Device Named Entity Recognition (NER)
 * Uses Xenova/bert-base-NER via @xenova/transformers running 100% locally.
 * Produces independently-scored predictions before LLM extraction.
 */

export interface NEREntitySpan {
  text: string;
  type: 'PER' | 'LOC' | 'ORG' | 'MISC';
  score: number;
}

let nerPipeline: any = null;

function normalizeEntityType(rawType: string): 'PER' | 'LOC' | 'ORG' | 'MISC' {
  const clean = rawType.replace(/^[BI]-/, '').toUpperCase();
  if (clean === 'PER' || clean === 'PERSON') return 'PER';
  if (clean === 'LOC' || clean === 'LOCATION') return 'LOC';
  if (clean === 'ORG' || clean === 'ORGANIZATION') return 'ORG';
  return 'MISC';
}

function reconstructWordSpans(tokens: any[]): NEREntitySpan[] {
  const spans: NEREntitySpan[] = [];
  let current: NEREntitySpan | null = null;
  let lastIndex = -1;

  for (const token of tokens) {
    if (!token.word || !token.entity) continue;

    const normType = normalizeEntityType(token.entity);
    const isSubword = token.word.startsWith('##');
    const cleanWord = isSubword ? token.word.slice(2) : token.word;
    const isContinuation = current && (
      isSubword ||
      (token.entity.startsWith('I-') && current.type === normType) ||
      (token.index === lastIndex + 1 && current.type === normType && !token.entity.startsWith('B-'))
    );

    if (current && isContinuation) {
      current.text += isSubword ? cleanWord : (' ' + cleanWord);
      current.score = Math.max(current.score, token.score);
    } else {
      if (current && current.text.trim().length > 1) {
        spans.push({
          text: current.text.trim(),
          type: current.type,
          score: Number(current.score.toFixed(4))
        });
      }
      current = {
        text: cleanWord,
        type: normType,
        score: token.score
      };
    }
    lastIndex = token.index ?? lastIndex + 1;
  }

  if (current && current.text.trim().length > 1) {
    spans.push({
      text: current.text.trim(),
      type: current.type,
      score: Number(current.score.toFixed(4))
    });
  }

  // Deduplicate identical span texts and types keeping highest score
  const deduped = new Map<string, NEREntitySpan>();
  for (const span of spans) {
    const key = `${span.text.toLowerCase()}::${span.type}`;
    const existing = deduped.get(key);
    if (!existing || existing.score < span.score) {
      deduped.set(key, span);
    }
  }

  return Array.from(deduped.values());
}

export async function extractNamedEntities(text: string): Promise<NEREntitySpan[]> {
  const clean = text?.trim();
  if (!clean) return [];

  try {
    if (!nerPipeline) {
      const { pipeline } = await import('@xenova/transformers');
      nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER', {
        quantized: true
      });
    }

    const rawTokens = await nerPipeline(clean);
    if (!Array.isArray(rawTokens) || rawTokens.length === 0) return [];

    return reconstructWordSpans(rawTokens);
  } catch (err) {
    console.warn('[extractNamedEntities] NER inference failed, returning empty spans:', err);
    return [];
  }
}
