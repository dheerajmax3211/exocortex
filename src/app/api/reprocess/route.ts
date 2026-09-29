import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';
import { placeNewEntity } from '@/lib/graph/layout';

const reprocessSchema = z.object({
  event_date: z.string().nullable(),
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
    value: z.string()
  }))
});

async function processSingleEntry(supabase: any, user: any, entry: any, meEntityId: string) {
  // Fetch existing candidates
  const { data: candidates } = await supabase.rpc('search_entities', {
    p_query: entry.raw_text.slice(0, 50),
    p_user_id: user.id
  });

  const extraction = await chatJSON({
    system: 'Extract entities, edges, facts, and event dates from raw memory text into a structured graph.',
    prompt: `Entry Text: "${entry.raw_text}"\nExisting Entities: ${JSON.stringify(candidates || [])}`,
    schema: reprocessSchema
  });

  const idMap: Record<string, string> = { me: meEntityId };

  // Match or create entities
  for (const ent of extraction.entities) {
    let existing = (candidates || []).find((c: any) => 
      c.name.toLowerCase() === ent.name.toLowerCase() && c.type === ent.type
    );

    let entId = existing?.id;
    if (!entId) {
      const created = await db.createEntity(supabase, {
        user_id: user.id,
        type: ent.type,
        name: ent.name,
        aliases: ent.aliases || [],
        summary: ent.summary || null,
        props: ent.props || {},
        created_from_entry: entry.id
      });
      if (created) {
        entId = created.id;
        await placeNewEntity(supabase, created.id, [], user.id).catch(() => {});
      }
    }

    if (entId) {
      idMap[ent.temp_id] = entId;
      await db.linkEntryEntity(supabase, { entry_id: entry.id, entity_id: entId }).catch(() => {});
    }
  }

  // Create edges
  for (const edge of extraction.edges) {
    const srcId = idMap[edge.src_temp_id];
    const dstId = idMap[edge.dst_temp_id];
    if (srcId && dstId && srcId !== dstId) {
      await db.createEdge(supabase, {
        user_id: user.id,
        src: srcId,
        dst: dstId,
        relation: edge.relation,
        props: edge.props || {},
        entry_id: entry.id,
        occurred_on: extraction.event_date || null
      });
    }
  }

  // Create facts
  for (const fact of extraction.facts) {
    const entId = idMap[fact.entity_temp_id];
    if (entId) {
      await db.createFact(supabase, {
        user_id: user.id,
        entity_id: entId,
        key: fact.key,
        value: fact.value,
        entry_id: entry.id
      });
    }
  }

  // Update entry
  await db.updateEntry(supabase, entry.id, {
    status: 'committed',
    event_date: extraction.event_date || entry.event_date || null
  });
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
      const entry = await db.getEntry(supabase, body.entry_id);
      if (!entry) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }

      await processSingleEntry(supabase, user, entry, meEntity.id);
      return NextResponse.json({ success: true, reprocessed: 1, entry_id: body.entry_id });
    }

    // Reprocess all committed entries (capped at 50 per batch for Vercel Hobby limits)
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
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
