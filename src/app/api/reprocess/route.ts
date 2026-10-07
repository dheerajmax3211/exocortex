import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';
import { placeNewEntity } from '@/lib/graph/layout';
import { retrieveHighRecallCandidates } from '@/lib/entity-resolution';
import { validateEntryOwnership, boundedCandidates, safeAtomicCommit } from '@/lib/server/ingestion-helpers';

const reprocessSchema = z.object({
  event_date: z.string().nullable(),
  event_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  date_end: z.string().nullable().optional(),
  date_precision: z.enum(['day', 'month', 'year', 'period', 'unknown']).default('unknown'),
  entities: z.array(z.object({
    temp_id: z.string(),
    type: z.enum(['person', 'place', 'restaurant', 'dish', 'movie', 'show', 'book', 'school', 'org', 'period', 'event', 'item', 'other']),
    name: z.string(),
    aliases: z.array(z.string()).default([]),
    summary: z.string().nullable().optional(),
    props: z.record(z.string(), z.any()).default({})
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
    valid_from: z.string().nullable().optional(),
    valid_time_start: z.string().nullable().optional(),
    valid_time_precision: z.enum(['exact', 'approximate', 'date_only', 'unknown']).default('unknown'),
    supersedes_fact_id: z.string().nullable().optional()
  }))
});

async function processSingleEntry(supabase: any, user: any, entry: any, meEntityId: string) {
  // Fetch existing candidates bounded to 25
  const rawCandidates = await retrieveHighRecallCandidates(supabase, user.id, entry.raw_text);
  const candidates = boundedCandidates(rawCandidates, 25);

  const extraction = await chatJSON({
    system: 'Extract entities, edges, facts, and event dates from raw memory text into a structured graph.',
    prompt: `Entry Text: "${entry.raw_text}"\nExisting Entities: ${JSON.stringify(candidates.map(c => ({ id: c.id, name: c.name, type: c.type, aliases: c.aliases })))}`,
    schema: reprocessSchema
  });

  const idMap: Record<string, string> = { me: meEntityId };
  const newEntityWrites: any[] = [];
  const entityUpdates: any[] = [];
  const uniqueEntityIds: string[] = [meEntityId];

  // Match or create entities
  for (const ent of extraction.entities) {
    let existing = candidates.find((c: any) =>
      c.name.toLowerCase() === ent.name.toLowerCase() && (!ent.type || c.type === ent.type)
    );

    let entId = existing?.id;
    if (!entId) {
      entId = crypto.randomUUID();
      newEntityWrites.push({
        id: entId,
        user_id: user.id,
        type: ent.type,
        name: ent.name,
        aliases: ent.aliases || [],
        summary: ent.summary || null,
        props: ent.props || {},
        created_from_entry: entry.id
      });
    } else {
      entityUpdates.push({
        entity_id: entId,
        props: ent.props || {}
      });
    }

    idMap[ent.temp_id] = entId;
    if (!uniqueEntityIds.includes(entId)) {
      uniqueEntityIds.push(entId);
    }
  }

  // Edges
  const edgeWrites: any[] = [];
  for (const edge of extraction.edges) {
    const srcId = idMap[edge.src_temp_id];
    const dstId = idMap[edge.dst_temp_id];
    if (srcId && dstId && srcId !== dstId) {
      edgeWrites.push({
        src: srcId,
        dst: dstId,
        relation: edge.relation,
        props: edge.props || {},
        entry_id: entry.id,
        occurred_on: extraction.event_date || null,
        valid_from: extraction.event_date || null,
        learned_at: new Date().toISOString()
      });
    }
  }

  // Facts
  const factWrites: any[] = [];
  for (const fact of extraction.facts) {
    const entId = idMap[fact.entity_temp_id];
    if (entId) {
      factWrites.push({
        entity_id: entId,
        key: fact.key,
        value: fact.value,
        entry_id: entry.id,
        valid_from: fact.valid_from || extraction.event_date || null,
        valid_time_start: fact.valid_time_start || null,
        valid_time_precision: fact.valid_time_precision || 'unknown',
        supersedes_fact_id: fact.supersedes_fact_id || null
      });
    }
  }

  // Atomic commit with fallback
  await safeAtomicCommit(supabase, {
    entry_id: entry.id,
    user_id: user.id,
    commitAttempt: 1,
    newEntityWrites,
    entityUpdates,
    uniqueEntityIds,
    contextLinks: [],
    edgeWrites,
    factWrites,
    event_date: extraction.event_date || entry.event_date || null,
    event_time: extraction.event_time || null,
    date_end: extraction.date_end || null,
    date_precision: extraction.date_precision || 'day'
  });

  // Post-commit layout
  for (const newEnt of newEntityWrites) {
    await placeNewEntity(supabase, newEnt.id, [], user.id).catch(() => {});
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const meEntity = await db.getOrCreateMeEntity(supabase, user.id);

    if (body.entry_id) {
      const entry = await validateEntryOwnership(supabase, body.entry_id, user.id);
      if (!entry) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }

      await processSingleEntry(supabase, user, entry, meEntity.id);
      return NextResponse.json({ success: true, reprocessed: 1, entry_id: body.entry_id });
    }

    // Reprocess all committed entries (capped at 50 per batch for Vercel limits)
    const { data: entries } = await supabase
      .from('entries')
      .select('id, user_id, raw_text, status, event_date')
      .eq('user_id', user.id)
      .order('entered_at', { ascending: false })
      .limit(50);

    if (!entries || entries.length === 0) {
      return NextResponse.json({ success: true, reprocessed: 0, message: 'No entries to reprocess' });
    }

    let count = 0;
    for (const entry of entries) {
      try {
        await processSingleEntry(supabase, user, entry, meEntity.id);
        count++;
      } catch (err) {
        console.error('Failed to reprocess entry', entry.id, err);
      }
    }

    return NextResponse.json({
      success: true,
      reprocessed: count,
      message: `Reprocessed ${count} entries into your knowledge graph.`
    });
  } catch (error: any) {
    console.error('Reprocess error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
