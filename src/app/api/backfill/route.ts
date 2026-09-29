import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';
import { placeNewEntity } from '@/lib/graph/layout';

const backfillExtractionSchema = z.object({
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
    relation: z.string(), // taught, classmate_of, studied_at, attended_with
    props: z.record(z.string(), z.any()).default({})
  }))
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { period_name, start_date, end_date, fields } = await req.json();

    if (!period_name) {
      return NextResponse.json({ error: 'period_name is required' }, { status: 400 });
    }

    const meEntity = await db.getOrCreateMeEntity(supabase, user.id);

    // 1. Get or create period entity
    let { data: periodEntity } = await supabase
      .from('entities')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'period')
      .eq('name', period_name)
      .is('deleted_at', null)
      .maybeSingle();

    if (!periodEntity) {
      periodEntity = await db.createEntity(supabase, {
        user_id: user.id,
        type: 'period',
        name: period_name,
        start_date: start_date || null,
        end_date: end_date || null,
        summary: `Life period: ${period_name}`
      });
      if (periodEntity) {
        await placeNewEntity(supabase, periodEntity.id, [], user.id).catch(() => {});
      }
    }

    const periodId = periodEntity?.id;
    let totalEntitiesCreated = 0;
    let totalEdgesCreated = 0;

    // 2. Combine non-empty field inputs into structured backfill memory
    const fieldEntries: { field: string; content: string }[] = [];
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value === 'string' && value.trim()) {
          fieldEntries.push({ field: key, content: value.trim() });
        }
      }
    }

    if (fieldEntries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Period created, but no field content provided.',
        periodId
      });
    }

    // 3. Process fields with LLM extraction
    for (const item of fieldEntries) {
      const rawText = `Backfill for ${period_name} [${item.field}]: ${item.content}`;

      // Create raw entry with source='backfill' and date_precision='period'
      const entry = await db.createEntry(supabase, {
        user_id: user.id,
        raw_text: rawText,
        source: 'backfill',
        date_precision: 'period',
        status: 'committed',
        event_date: start_date || null,
        date_end: end_date || null
      });

      const prompt = `Life Period: "${period_name}".
Field Category: "${item.field}".
Content written by user: "${item.content}".
Extract all people, schools, events, and relationships.
Example relations: 'studied_at' (Me -> School), 'taught' (Teacher -> Me with props: {subject}), 'classmate_of' (Me <-> Person), 'attended_with' (Person -> Event).
Ensure one entity represents Me with temp_id 'me'.`;

      try {
        const extraction = await chatJSON({
          system: 'You are a knowledge graph extractor specializing in retrospective memory backfills.',
          prompt,
          schema: backfillExtractionSchema
        });

        const idMap: Record<string, string> = { me: meEntity.id };

        // Create extracted entities
        for (const ent of extraction.entities) {
          if (ent.temp_id === 'me') continue;
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
            idMap[ent.temp_id] = created.id;
            totalEntitiesCreated++;

            // Link to period entity
            if (periodId) {
              await db.createEdge(supabase, {
                user_id: user.id,
                src: created.id,
                dst: periodId,
                relation: 'during_period',
                entry_id: entry.id
              }).catch(() => {});
            }

            // Link to entry_entities
            await db.linkEntryEntity(supabase, {
              entry_id: entry.id,
              entity_id: created.id
            }).catch(() => {});

            await placeNewEntity(supabase, created.id, [{ src: created.id, dst: periodId || meEntity.id }], user.id).catch(() => {});
          }
        }

        // Create extracted edges
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
              entry_id: entry.id
            });
            totalEdgesCreated++;
          }
        }
      } catch (err) {
        console.error(`Backfill field processing error on ${item.field}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      periodId,
      createdEntitiesCount: totalEntitiesCreated,
      createdEdgesCount: totalEdgesCreated,
      message: `Backfilled ${period_name} with ${totalEntitiesCreated} entities and ${totalEdgesCreated} connections.`
    });
  } catch (error: any) {
    console.error('Backfill API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
