import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';

const briefingSchema = z.object({
  headline: z.string(),
  how_you_know_them: z.string(),
  last_interaction: z.string().nullable(),
  shared_activities: z.array(z.string()),
  key_notes: z.array(z.string())
});

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entity_id = searchParams.get('entity_id');
    const name = searchParams.get('name');

    let targetEntity = null;

    if (entity_id) {
      targetEntity = await db.getEntity(supabase, entity_id);
    } else if (name) {
      const candidates = await db.searchEntities(supabase, name, user.id);
      targetEntity = candidates?.[0] || null;
    }

    if (!targetEntity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Fetch facts, edges, and source entries
    const [facts, edges, entries] = await Promise.all([
      db.getFactsForEntity(supabase, targetEntity.id),
      db.getEdgesForEntity(supabase, targetEntity.id),
      db.getEntriesForEntity(supabase, targetEntity.id)
    ]);

    const prompt = `Entity to brief on: "${targetEntity.name}" (${targetEntity.type})
Summary: "${targetEntity.summary || 'None'}"
Aliases: ${JSON.stringify(targetEntity.aliases || [])}
Known Facts: ${JSON.stringify(facts)}
Connections: ${JSON.stringify(edges)}
Referenced in Memories: ${JSON.stringify(entries.map(e => ({ date: e.event_date || e.entered_at, text: e.raw_text })))}

Generate an executive personal briefing about this person or entity based strictly on the recorded history.
Include how you know them, when you last met or interacted, shared events/dishes, and important reminders.`;

    const briefing = await chatJSON({
      system: 'You are an intelligent personal memory dossier assistant. Never hallucinate facts.',
      prompt,
      schema: briefingSchema
    });

    return NextResponse.json({
      entity: targetEntity,
      briefing
    });
  } catch (error: any) {
    console.error('Briefing error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
