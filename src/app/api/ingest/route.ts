import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';

const extractionSchema = z.object({
  event_date: z.string().nullable().describe("YYYY-MM-DD date if this relates to a specific day, else null"),
  date_end: z.string().nullable(),
  date_precision: z.enum(['day', 'month', 'year', 'period', 'unknown']).default('unknown'),
  entities: z.array(z.object({
    temp_id: z.string(),
    type: z.enum(['person', 'place', 'restaurant', 'dish', 'movie', 'show', 'book', 'school', 'org', 'period', 'event', 'item', 'other']),
    name: z.string(),
    aliases: z.array(z.string()).default([]),
    summary: z.string().nullable().optional(),
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
    value: z.string()
  })),
  event: z.object({
    name: z.string(),
    summary: z.string()
  }).nullable().optional(),
  questions: z.array(z.string()).default([])
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, source } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // 1. Save verbatim raw text to entries with status='draft'
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        raw_text: text,
        source: source || 'typed',
        status: 'draft'
      })
      .select('id')
      .single();

    if (entryError) {
      console.error('Entry insert error:', entryError);
      return NextResponse.json({ error: 'Failed to save raw entry' }, { status: 500 });
    }

    // 2. Retrieve candidates: trigram search of existing entities for capitalized or likely names
    const words = text.match(/\b[A-Za-z0-9_'-]+\b/g) || [];
    const capitalized = Array.from(new Set(words.filter(w => w.length > 2 && /^[A-Z]/.test(w))));
    let candidates: any[] = [];

    if (capitalized.length > 0) {
      for (const name of capitalized.slice(0, 10)) {
        const { data: matches } = await supabase.rpc('search_entities', {
          p_query: name,
          p_user_id: user.id
        });
        if (matches && matches.length > 0) {
          candidates.push(...matches.slice(0, 5));
        }
      }
      // Deduplicate candidates by ID
      const seen = new Set();
      candidates = candidates.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    }

    // Fetch user's known life periods to resolve relative dates like "in 8th grade"
    const { data: periods } = await supabase
      .from('entities')
      .select('id, name, start_date, end_date')
      .eq('user_id', user.id)
      .eq('type', 'period')
      .is('deleted_at', null);

    const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const currentDay = new Date().toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

    // 3. One LLM call with current time, raw text, candidates, and periods
    const systemPrompt = `You are the knowledge graph extraction engine for Virtual Brain (a personal memory graph system).
Current Time in IST: ${currentIst} (${currentDay}).

EXTRACTION RULES:
1. Dates:
   - Resolve relative dates ("today", "yesterday", "last Friday", "in 2012", "in 8th grade") against current date and Known Life Periods.
   - If exact day known: date_precision='day', event_date='YYYY-MM-DD'.
   - If month/year: date_precision='month'|'year', event_date='YYYY-MM-01'.
   - If truly undatable: date_precision='unknown', event_date=null.

2. Modeling Rules:
   - Events are entities (type='event') with date; participants and place attach via edges (attended_with, at).
   - Restaurant -> dish is an edge 'served' or 'tried' with props: rating_10 (number /10 if explicitly stated), sentiment ('good'|'bad'|'neutral'), quote (original verbatim words). NEVER invent a number rating. If user says "amazing" or "good" -> sentiment='good', rating_10=null. If "bad" -> sentiment='bad'.
   - Movies/shows/books: type='movie'|'show'|'book' with edge 'watched'|'read' from Me, occurred_on, rating_10, sentiment, quote.
   - Life periods: type='period' (e.g. "8th grade", "MSc") with date ranges. People/schools attach via edges: taught (props.subject), classmate_of, studied_at.
   - People: type='person'.

3. Matching & Ambiguity:
   - Compare extracted names against Candidate Existing Entities.
   - Merge into an existing entity ONLY when confident (confidence > 0.85).
   - If genuinely ambiguous (e.g. "Rahul" mentioned and multiple Rahuls exist in candidates), set match: null and add a clarifying question: "Which Rahul? (e.g. Rahul Sharma or Rahul K)".`;

    const extraction = await chatJSON({
      system: systemPrompt,
      prompt: `Raw Memory Entry:\n"${text}"\n\nCandidate Existing Entities in Graph:\n${JSON.stringify(candidates.map(c => ({ id: c.id, type: c.type, name: c.name, aliases: c.aliases, summary: c.summary })), null, 2)}\n\nKnown Life Periods:\n${JSON.stringify(periods || [], null, 2)}`,
      schema: extractionSchema
    });

    return NextResponse.json({
      entry_id: entry.id,
      extraction,
      candidates
    });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
