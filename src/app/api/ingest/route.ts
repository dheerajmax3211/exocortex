import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';

const extractionSchema = z.object({
  event_date: z.string().nullable().describe("YYYY-MM-DD date if this relates to a specific day, else null"),
  date_end: z.string().nullable(),
  date_precision: z.enum(['day', 'month', 'year', 'unknown']).default('unknown'),
  entities: z.array(z.object({
    temp_id: z.string(),
    type: z.enum(['person', 'place', 'restaurant', 'dish', 'movie', 'show', 'book', 'school', 'org', 'period', 'event', 'item', 'other']),
    name: z.string(),
    aliases: z.array(z.string()).default([]),
    summary: z.string().nullable(),
    props: z.record(z.string(), z.any()).default({}),
    match: z.object({
      existing_id: z.string().nullable(),
      confidence: z.number()
    }).nullable()
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
    value: z.any()
  })),
  event: z.object({
    name: z.string(),
    summary: z.string()
  }).nullable(),
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

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Save to entries with draft status
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        raw_text: text,
        source: source || 'app',
        status: 'draft'
      })
      .select('id')
      .single();

    if (entryError) {
      console.error(entryError);
      return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
    }

    // Candidate Retrieval: rough check for capitalized words as possible entities
    const words = text.match(/\b[A-Z][a-z]*\b/g) || [];
    let candidates = [];
    if (words.length > 0) {
      const query = words.join(' ');
      const { data: candidateData } = await supabase.rpc('search_entities', {
        p_query: query,
        p_user_id: user.id
      });
      candidates = candidateData || [];
    }
    
    const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const currentDay = new Date().toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

    const systemPrompt = `You are a memory graph extraction assistant.
Current Time in IST: ${currentIst} (${currentDay}).
Extract the entities, facts, and relationships from the text.
Use the provided candidates list to match against existing entities.
Only extract what is explicitly stated or can be strongly inferred.`;

    const object = await chatJSON({
      system: systemPrompt,
      prompt: `Text to analyze:\n${text}\n\nCandidate Existing Entities:\n${JSON.stringify(candidates, null, 2)}`,
      schema: extractionSchema
    });

    return NextResponse.json({
      entry_id: entry.id,
      extraction: object
    });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
