import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';
import * as db from '@/lib/db';
import { placeNewEntity } from '@/lib/graph/layout';

const normalizationSchema = z.object({
  items: z.array(z.object({
    raw: z.string(),
    normalized_title: z.string(),
    year: z.number().nullable().optional(),
    rating_10: z.number().nullable().optional(),
    sentiment: z.enum(['good', 'bad', 'neutral']).optional()
  }))
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, type, action } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const validEntityType = type || 'movie';

    // 1. ACTION = PREVIEW: Chunk items, normalize via LLM, dedupe against existing entities
    if (action === 'preview') {
      const parsedItems: any[] = [];

      // Process in batches of 25 items for fast API execution
      const chunks = [];
      for (let i = 0; i < Math.min(items.length, 100); i += 25) {
        chunks.push(items.slice(i, i + 25));
      }

      for (const chunk of chunks) {
        try {
          const res = await chatJSON({
            system: 'You are an entity normalization engine. Parse list items into clean titles, optional release year, and optional rating normalized out of 10.',
            prompt: `Entity Type: ${validEntityType}\nItems to normalize (one per line):\n${chunk.join('\n')}`,
            schema: normalizationSchema
          });
          parsedItems.push(...(res.items || []));
        } catch (e) {
          // Fallback to regex parsing if LLM times out
          for (const raw of chunk) {
            const parts = raw.split('|').map((s: string) => s.trim());
            const ratingNum = parts.length > 1 ? parseFloat(parts[1]) : undefined;
            const yearNum = parts.length > 2 ? parseInt(parts[2]) : undefined;
            parsedItems.push({
              raw,
              normalized_title: parts[0],
              rating_10: !isNaN(ratingNum as any) ? ratingNum : null,
              year: !isNaN(yearNum as any) ? yearNum : null
            });
          }
        }
      }

      // Check against existing entities of that type in user's graph
      const existingEntities = await db.getEntitiesByType(supabase, validEntityType as any, { limit: 1000 });
      const existingNameMap = new Map<string, string>();
      for (const ent of existingEntities) {
        existingNameMap.set(ent.name.toLowerCase().trim(), ent.id);
        if (ent.aliases) {
          for (const a of ent.aliases) {
            existingNameMap.set(a.toLowerCase().trim(), ent.id);
          }
        }
      }

      const newItems: any[] = [];
      const duplicateItems: any[] = [];

      for (const item of parsedItems) {
        const normKey = item.normalized_title.toLowerCase().trim();
        if (existingNameMap.has(normKey)) {
          duplicateItems.push({
            ...item,
            existing_id: existingNameMap.get(normKey)
          });
        } else {
          newItems.push(item);
        }
      }

      return NextResponse.json({
        total: parsedItems.length,
        new: newItems,
        duplicates: duplicateItems
      });
    }

    // 2. ACTION = COMMIT: Save confirmed items to DB, link to 'Me' entity
    if (action === 'commit') {
      const meEntity = await db.getOrCreateMeEntity(supabase, user.id);
      let createdCount = 0;

      for (const item of items) {
        const title = item.normalized_title || item.title || item.raw;
        if (!title) continue;

        // Create entity
        const newEntity = await db.createEntity(supabase, {
          user_id: user.id,
          type: validEntityType as any,
          name: title,
          aliases: item.year ? [`${title} (${item.year})`] : [],
          props: {
            year: item.year || null,
            rating_10: item.rating_10 || null,
            sentiment: item.sentiment || (item.rating_10 && item.rating_10 >= 7 ? 'good' : 'neutral')
          }
        });

        if (newEntity) {
          createdCount++;

          // Create edge from "Me" entity (e.g. watched, visited, read)
          let relation = 'consumed';
          if (validEntityType === 'movie' || validEntityType === 'show') relation = 'watched';
          else if (validEntityType === 'restaurant') relation = 'visited';
          else if (validEntityType === 'book') relation = 'read';

          await db.createEdge(supabase, {
            user_id: user.id,
            src: meEntity.id,
            dst: newEntity.id,
            relation,
            props: {
              rating_10: item.rating_10 || null,
              sentiment: item.sentiment || null
            }
          });

          // Place in layout
          await placeNewEntity(supabase, newEntity.id, [{ src: meEntity.id, dst: newEntity.id }], user.id).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        count: createdCount,
        message: `Successfully imported ${createdCount} ${validEntityType}s into your brain.`
      });
    }

    return NextResponse.json({ error: 'Invalid action. Must be preview or commit.' }, { status: 400 });
  } catch (error: any) {
    console.error('Import API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
