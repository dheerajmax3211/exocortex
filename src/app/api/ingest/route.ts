import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { stringSimilarity } from '@/lib/entity-resolution';
import { z } from 'zod';
import { enqueueExtraction, completeJob } from '@/lib/server/extraction-queue';
import { ServerTiming } from '@/lib/server/timing';

const extractionSchema = z.object({
  event_date: z.string().nullable().describe("YYYY-MM-DD date if this relates to a specific day, else null"),
  event_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional()
    .describe('Exact local event time as HH:mm only when explicitly exact or clearly implied by “now”; use null for approximate times.'),
  event_time_precision: z.enum(['exact', 'approximate', 'unknown']).default('unknown')
    .describe('Whether the event time is exact, approximate, or unknown. Approximate times must not be returned in event_time.'),
  date_end: z.string().nullable(),
  date_precision: z.enum(['day', 'month', 'year', 'period', 'unknown']).default('unknown'),
  entities: z.array(z.object({
    temp_id: z.string(),
    type: z.enum(['person', 'place', 'restaurant', 'dish', 'movie', 'show', 'book', 'school', 'org', 'period', 'event', 'item', 'other']),
    name: z.string(),
    aliases: z.array(z.string()).default([]),
    summary: z.string().nullable().optional(),
    parent_context_temp_id: z.string().nullable().optional(),
    props: z.record(z.string(), z.any()).default({}),
    match: z.object({
      existing_id: z.string().nullable(),
      confidence: z.number(),
      candidate_names: z.array(z.string()).optional()
    }).nullable().optional()
  })),
  edges: z.array(z.object({
    src_temp_id: z.string(),
    dst_temp_id: z.string(),
    relation: z.string(),
    props: z.record(z.string(), z.any()).default({})
  })),
  facts: z.array(z.object({
    entity_temp_id: z.string(),
    key: z.string(),
    value: z.string(),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    valid_time_start: z.string().datetime({ offset: true }).nullable().optional(),
    valid_time_precision: z.enum(['exact', 'approximate', 'date_only', 'unknown']).default('unknown')
      .describe('Precision of the stated fact time. If approximate or date_only, valid_time_start must be null.'),
    supersedes_fact_id: z.string().uuid().nullable().optional()
  })),
  event: z.object({
    name: z.string(),
    summary: z.string()
  }).nullable().optional(),
  questions: z.array(z.string()).default([])
});

const EXTRACTION_SCHEMA_DESC = `{
  "event_date": "YYYY-MM-DD or null",
  "event_time": "HH:mm (exact local time only) or null",
  "event_time_precision": "exact | approximate | unknown",
  "date_end": "YYYY-MM-DD or null",
  "date_precision": "day | month | year | period | unknown",
  "entities": [
    {
      "temp_id": "string ('me' for root user)",
      "type": "person | place | restaurant | dish | movie | show | book | school | org | period | event | item | other",
      "name": "Full canonical name",
      "aliases": ["string"],
      "summary": "1-sentence summary or null",
      "props": {},
      "match": { "existing_id": "uuid or null", "confidence": 1.0 }
    }
  ],
  "edges": [
    { "src_temp_id": "string", "dst_temp_id": "string", "relation": "string", "props": {} }
  ],
  "facts": [
    {
      "entity_temp_id": "string",
      "key": "string",
      "value": "string",
      "valid_from": "YYYY-MM-DD or null",
      "valid_time_start": "ISO string or null",
      "valid_time_precision": "exact | approximate | date_only | unknown",
      "supersedes_fact_id": "uuid or null"
    }
  ],
  "event": { "name": "string", "summary": "string" },
  "questions": []
}`;

function chunkText(text: string, maxChunkSize = 2500): string[] {
  if (text.length <= maxChunkSize) return [text];
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) return [text];

  const chunks: string[] = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if (!currentChunk) {
      currentChunk = p;
    } else if (currentChunk.length + p.length + 2 <= maxChunkSize) {
      currentChunk += '\n\n' + p;
    } else {
      chunks.push(currentChunk);
      currentChunk = p;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

function cacheSet(entryId: string, value: any) {
  if (!(globalThis as any).__extractionCache || typeof (globalThis as any).__extractionCache.set !== 'function') {
    (globalThis as any).__extractionCache = new Map();
  }
  (globalThis as any).__extractionCache.set(entryId, value);
}

export async function POST(req: Request) {
  const timing = new ServerTiming();
  try {
    const supabase = await createClient();
    let { data: { user } } = await supabase.auth.getUser();

    const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;

    if (!user && !isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user && isCron) {
      // For cron jobs, we need the user_id from the payload to act on their behalf
      const body = await req.clone().json().catch(() => ({}));
      if (body.user_id) {
        user = { id: body.user_id } as any;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized or missing user_id' }, { status: 401 });
    }

    const { text, source } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const url = new URL(req.url);
    const isAsync = url.searchParams.get('async') === 'true' || req.headers.get('x-async') === 'true';

    // 1. Save verbatim raw text to entries
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        raw_text: text,
        source: source || 'typed',
        status: isAsync ? 'extracting' : 'draft'
      })
      .select('id')
      .single();

    if (entryError) {
      console.error('Entry insert error:', entryError);
      return NextResponse.json({ error: 'Failed to save raw entry' }, { status: 500 });
    }

    if (isAsync) {
      await enqueueExtraction(supabase, entry.id, user.id);
      cacheSet(entry.id, { status: 'extracting' });
    }

    const extractionTask = async () => {
      try {
        // We need a fresh client for background tasks if running async, but createClient in nextjs
        // uses cookies which might not be accessible in background context after response.
        // For simplicity we will use the same supabase client, though in Edge/Vercel it might fail.
        // Actually, we can just use the provided client since it's a standard serverless function.

        // On-device ML passes: local NER and sentiment grounding
        const { extractNamedEntities } = await import('@/lib/ml/ner');
        const { scoreEntryClauses } = await import('@/lib/ml/sentiment');
        const [nerSpans, sentimentScores] = await Promise.all([
          extractNamedEntities(text),
          scoreEntryClauses(text)
        ]);

        try {
          if (nerSpans.length > 0) {
            await supabase.from('entry_ner_spans').insert(
              nerSpans.map(s => ({ entry_id: entry.id, text: s.text, type: s.type, score: s.score }))
            );
          }
          if (sentimentScores.length > 0) {
            await supabase.from('entry_sentiment_scores').insert(
              sentimentScores.map(s => ({ entry_id: entry.id, clause: s.clause, label: s.label, score: s.score }))
            );
          }
        } catch (dbErr) {
          console.warn('[ingest] ML inspection tables insert skipped (pending migration):', dbErr);
        }

        // 2. Comprehensive Graph Taxonomy & Candidate Retrieval
        const { retrieveHighRecallCandidates } = await import('@/lib/entity-resolution');
        const { getOrCreateMeEntity } = await import('@/lib/db');
        const me = await getOrCreateMeEntity(supabase, user.id);

        // Augment candidate retrieval text with independently tagged NER spans
        const candidateSearchText = nerSpans.length > 0
          ? `${text} ${nerSpans.map(s => s.text).join(' ')}`
          : text;

        // Fetch high-recall candidates bounded to 25 to optimize latency and prompt tokens
        const highRecall = await retrieveHighRecallCandidates(supabase, user.id, candidateSearchText);
        const candidateMap = new Map<string, any>();
        for (const h of highRecall.slice(0, 24)) {
          candidateMap.set(h.id, h);
        }

        const candidates: any[] = Array.from(candidateMap.values());
        const meIdx = candidates.findIndex(c => c.id === me.id);
        if (meIdx >= 0) candidates.splice(meIdx, 1);
        candidates.unshift({
          id: me.id,
          type: 'person',
          name: me.name,
          aliases: me.aliases || ['me', 'i', 'myself'],
          summary: 'The user / author of these memories'
        });

        const { data: periods } = await supabase
          .from('entities')
          .select('id, name, start_date, end_date')
          .eq('user_id', user.id)
          .eq('type', 'period')
          .is('deleted_at', null);

        const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const currentDay = new Date().toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

        const systemPrompt = `You are the knowledge graph extraction engine for Virtual Brain.
Current Date & Time in IST: ${currentIst} (${currentDay}).

EXTRACTION RULES:
1. ROOT USER IDENTITY ('me'):
- The user/author is "${me.name}" (ID: "${me.id}", Aliases: ${JSON.stringify(me.aliases || [])}).
- For mentions of "I", "me", "my", "myself", or the user stating their name, ALWAYS use temp_id='me' with type='person'. NEVER create a duplicate person entity for the user.
- BIOGRAPHICAL ATTRIBUTES ARE FACTS ON 'me' (NEVER ENTITIES):
  DOB/birthday (key='birth_date', value='YYYY-MM-DD'), age (key='age'), full name (key='full_name'), weight (key='weight'), height (key='height'), phone (key='phone'), email (key='email'), blood group (key='blood_type'), salary (key='salary'), gender (key='gender'), hometown (key='hometown').
  Example: "I weigh 62 kg" -> entities: [me only], facts: [{entity_temp_id: 'me', key: 'weight', value: '62 kg'}], edges: [].

2. CANONICAL NAMES & WORLD KNOWLEDGE:
- Expand abbreviations/slang to canonical names (e.g. "himym" -> "How I Met Your Mother", "b99" -> "Brooklyn Nine-Nine", "z50" -> "Nikon Z50", "mcoc" -> "Marvel Contest of Champions").
- Store original colloquial shorthand in the "aliases" array.

3. DEDUPLICATION (CANDIDATE MATCHING):
- Check "Candidate Existing Entities in Graph". If an entity refers to a candidate, set match: { existing_id: "<candidate.id>", confidence: 1.0 }. Do NOT create duplicate entities.

4. SCOPE & SALIENCE:
- Extract salient real-world entities mentioned (max 8-10 entities).
- Keep entity summaries concise (1 sentence max).
- Do NOT generate redundant intermediate category or taxonomy nodes (the graph hierarchy engine organizes domains automatically).
- If the input is purely personal attributes, entities array should contain ONLY 'me'.

5. TEMPORAL DATES & FACTS:
- Resolve relative dates ("yesterday", "last Friday") relative to current IST date.
- Extract all specific facts, numbers, dates, statuses, and specs into facts.`;

        const chunks = chunkText(text, 2500);

        const candidateIds = candidates.map(c => c.id);
        timing.start("graph_context");
        const { data: candidateEdges } = await supabase
          .from('edges')
          .select('src, dst, relation')
          .in('src', candidateIds)
          .is('deleted_at', null)
          .limit(60);

        // Build a mapping for fast name lookup
        const idToName = new Map(candidates.map(c => [c.id, c.name]));

        // Compact enriched candidates for low latency and token efficiency
        const enrichedCandidates = candidates.map(c => {
          const related = (candidateEdges || [])
            .filter(e => e.src === c.id)
            .slice(0, 3)
            .map(e => `${e.relation}->${idToName.get(e.dst) || 'node'}`);

          const obj: any = {
            id: c.id,
            name: c.name,
            type: c.type
          };
          if (c.aliases && c.aliases.length > 0) obj.aliases = c.aliases;
          if (related.length > 0) obj.edges = related;
          return obj;
        });

        const candidateContext = JSON.stringify(enrichedCandidates);
        const periodsContext = periods && periods.length > 0
          ? JSON.stringify(periods.map(p => ({ id: p.id, name: p.name, start: p.start_date, end: p.end_date })))
          : '[]';

        timing.end("graph_context");
        timing.start("llm_extraction");
        const extractionPromises = chunks.map(chunk => chatJSON({
          system: systemPrompt,
          prompt: `Raw Memory Entry (Chunk):\n"${chunk}"\n\nCandidate Existing Entities in Graph:\n${candidateContext}\n\nKnown Life Periods:\n${periodsContext}`,
          schema: extractionSchema,
          schemaDescription: EXTRACTION_SCHEMA_DESC
        }));

        const allExtractions = await Promise.all(extractionPromises);
        timing.end("llm_extraction");
        timing.start("chunk_merge");
        const mergedEntities = new Map<string, any>();
        const tempIdMapping = new Map<string, string>();
        const mergedEdges: any[] = [];
        const mergedFacts: any[] = [];
        const mergedQuestions = new Set<string>();

        let mergedEventDate: string | null = null;
        let mergedDateEnd: string | null = null;
        let mergedDatePrecision: 'day' | 'month' | 'year' | 'period' | 'unknown' = 'unknown';
        let mergedEvent: any = null;

        for (const ex of allExtractions) {
          if (!mergedEventDate && ex.event_date) mergedEventDate = ex.event_date;
          if (!mergedDateEnd && ex.date_end) mergedDateEnd = ex.date_end;
          if (mergedDatePrecision === 'unknown' && ex.date_precision !== 'unknown') {
            mergedDatePrecision = ex.date_precision;
          }
          if (!mergedEvent && ex.event) mergedEvent = ex.event;

          for (const ent of ex.entities) {
            if (ent.temp_id === 'me') {
              if (!mergedEntities.has('me')) {
                mergedEntities.set('me', ent);
              } else {
                const existing = mergedEntities.get('me');
                existing.props = { ...existing.props, ...ent.props };
                if (ent.summary && !existing.summary) existing.summary = ent.summary;
              }
              tempIdMapping.set('me', 'me');
              continue;
            }

            const normName = ent.name.toLowerCase().trim();
            const entAliases = (ent.aliases || []).map((a: string) => a.toLowerCase().trim());

            let matchedKey: string | null = null;
            for (const [key, existing] of mergedEntities.entries()) {
              if (key === 'me') continue;

              const existingNormName = existing.name?.toLowerCase().trim() || key;
              const existingAliases = (existing.aliases || []).map((a: string) => a.toLowerCase().trim());

              // 1. Exact normalized name or alias match
              if (
                key === normName ||
                existingAliases.includes(normName) ||
                entAliases.includes(key) ||
                entAliases.includes(existingNormName) ||
                entAliases.some((a: string) => existingAliases.includes(a))
              ) {
                matchedKey = key;
                break;
              }

              // 2. Fuzzy string similarity (catches 'birth-day' ≈ 'birthday', 'Interstellar Movie' ≈ 'Interstellar')
              // Use a lower threshold (0.80) since these are entities from the SAME input text
              const sim = stringSimilarity(ent.name, existing.name || key);
              if (sim >= 0.80 && (!ent.type || !existing.type || ent.type === existing.type)) {
                matchedKey = key;
                break;
              }

              // 3. Fuzzy match new name against existing aliases
              for (const alias of existingAliases) {
                if (alias.length > 2 && stringSimilarity(normName, alias) >= 0.82) {
                  matchedKey = key;
                  break;
                }
              }
              if (matchedKey) break;
            }

            if (matchedKey) {
              const existing = mergedEntities.get(matchedKey);
              tempIdMapping.set(ent.temp_id, existing.temp_id);
              existing.aliases = Array.from(new Set([...(existing.aliases || []), ...(ent.aliases || []), ent.name]));
              existing.props = { ...existing.props, ...ent.props };
              if (ent.summary && !existing.summary) existing.summary = ent.summary;
              if (ent.match?.existing_id && !existing.match?.existing_id) existing.match = ent.match;
            } else {
              mergedEntities.set(normName, ent);
              tempIdMapping.set(ent.temp_id, ent.temp_id);
            }
          }
        }

        for (const ex of allExtractions) {
          for (const edge of ex.edges) {
            mergedEdges.push({
              ...edge,
              src_temp_id: tempIdMapping.get(edge.src_temp_id) || edge.src_temp_id,
              dst_temp_id: tempIdMapping.get(edge.dst_temp_id) || edge.dst_temp_id,
            });
          }
          for (const fact of ex.facts) {
            mergedFacts.push({
              ...fact,
              entity_temp_id: tempIdMapping.get(fact.entity_temp_id) || fact.entity_temp_id,
            });
          }
          for (const q of (ex.questions || [])) {
            mergedQuestions.add(q);
          }
        }

        const uniqueEdges = [];
        const edgeSeen = new Set();
        for (const e of mergedEdges) {
          const key = `${e.src_temp_id}-${e.dst_temp_id}-${e.relation}`;
          if (!edgeSeen.has(key)) {
            edgeSeen.add(key);
            uniqueEdges.push(e);
          }
        }

        const uniqueFacts = [];
        const factSeen = new Set();
        for (const f of mergedFacts) {
          const key = `${f.entity_temp_id}-${f.key}-${f.value}`;
          if (!factSeen.has(key)) {
            factSeen.add(key);
            uniqueFacts.push(f);
          }
        }

        timing.end("chunk_merge");
        timing.start("hierarchy");
        const { restructureHierarchicalExtraction } = await import("@/lib/graph-hierarchy");
        const hierarchicalResult = await restructureHierarchicalExtraction(
          Array.from(mergedEntities.values()),
          uniqueEdges,
          uniqueFacts,
          candidates
        );

        timing.end("hierarchy");
        timing.log("INGEST");
        const finalExtraction = {
          event_date: mergedEventDate,
          date_end: mergedDateEnd,
          date_precision: mergedDatePrecision,
          entities: hierarchicalResult.entities,
          edges: hierarchicalResult.edges,
          facts: hierarchicalResult.facts,
          event: mergedEvent,
          questions: Array.from(mergedQuestions)
        };

        const newStatus = finalExtraction.questions.length > 0 ? 'draft' : 'ready';

        if (isAsync) {
          // In async mode, update the entry status and cache the extraction
          await supabase.from('entries').update({
            status: newStatus
          }).eq('id', entry.id);

          cacheSet(entry.id, {
            status: newStatus,
            extraction: finalExtraction,
            candidates,
            timings: timing.toJSON()
          });
          await completeJob(supabase, entry.id, 'completed');
        }

        return { finalExtraction, candidates, newStatus, timings: timing.toJSON() };
      } catch (err) {
        console.error('Background extraction error:', err);
        if (isAsync) {
          await supabase.from('entries').update({
            status: 'draft'
          }).eq('id', entry.id);

          cacheSet(entry.id, {
            status: 'error',
            error: String(err)
          });
          await completeJob(supabase, entry.id, 'failed', err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    };

    if (isAsync) {
      // Fire and forget
      after(async () => {
        await extractionTask().catch(e => console.error('Unhandled async extraction error:', e));
      });
      const res = NextResponse.json({
        entry_id: entry.id,
        status: "extracting",
        message: "Memory extraction underway in neural background"
      }, { status: 202 });
      res.headers.set("Server-Timing", timing.getHeader());
      return res;
    } else {
      // Sync execution
      const { finalExtraction, candidates, timings } = await extractionTask();
      const res = NextResponse.json({
        entry_id: entry.id,
        extraction: finalExtraction,
        candidates,
        timings
      });
      res.headers.set("Server-Timing", timing.getHeader());
      return res;
    }
  } catch (error: any) {
    console.error('Ingest error:', error);
    const res = NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    res.headers.set("Server-Timing", timing.getHeader());
    return res;
  }
}
