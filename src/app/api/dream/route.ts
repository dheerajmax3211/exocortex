import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';
import * as db from '@/lib/db';
import { updateCognitiveClusters } from '@/lib/community-clustering';

const dreamSchema = z.object({
  dream_title: z.string(),
  subconscious_insight: z.string().describe("A deep, candid 2-3 sentence reflection connecting disparate memories, written in 1st person"),
  connected_entity_names: z.array(z.string()).default([])
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch user's memory timeline (sample of older and recent entries)
    const { data: entries } = await supabase
      .from('entries')
      .select('id, raw_text, event_date, entered_at')
      .eq('user_id', user.id)
      .eq('status', 'committed')
      .order('entered_at', { ascending: false })
      .limit(35);

    if (!entries || entries.length < 2) {
      return NextResponse.json({ 
        message: 'Need at least 2 recorded memories for the brain to dream and discover patterns.' 
      });
    }

    // 2. Fetch key entities
    const { data: entities } = await supabase
      .from('entities')
      .select('id, name, type, summary')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(40);

    const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // 3. REM Dream & Cognitive Consolidation prompt
    const systemPrompt = `You are the Subconscious Consolidation Engine of Virtual Brain — the user's mind replaying memories during deep REM sleep.
Current Date in IST: ${currentIst}.
Your mission is to discover ONE unexpected pattern, emotional rhythm, or hidden synchronicity connecting past and recent events.
Speak strictly in the FIRST PERSON ("I noticed...", "My mind tends to...", "Looking across my life...").
Be psychologically sharp, observant, candid, and warm.`;

    const userPrompt = `Replaying my life memories during dream sleep:

RECENT & PAST MEMORIES:
${JSON.stringify(entries.map(e => ({ date: e.event_date || e.entered_at, text: e.raw_text.slice(0, 160) })), null, 2)}

ACTIVE ENTITIES IN MY GRAPH:
${JSON.stringify((entities || []).map(e => `${e.name} (${e.type})`), null, 2)}

Find an unstated synchronicity, recurring habit, or emotional rhythm. Synthesize it into a dream reflection.`;

    const dreamResult = await chatJSON({
      system: systemPrompt,
      prompt: userPrompt,
      schema: dreamSchema,
      temperature: 0.7
    });

    const dreamEntryText = `[Dream Consolidation] ${dreamResult.dream_title}: ${dreamResult.subconscious_insight}`;

    // 4. Commit dream reflection as an entry
    const newEntry = await db.createEntry(supabase, {
      user_id: user.id,
      raw_text: dreamEntryText,
      source: 'dream' as any,
      status: 'committed',
      event_date: new Date().toISOString().split('T')[0]
    });

    // Link to 'Me' entity
    const me = await db.getOrCreateMeEntity(supabase, user.id);
    await db.linkEntryEntity(supabase, {
      entry_id: newEntry.id,
      entity_id: me.id
    }).catch(() => {});

    // 5. Update cognitive clusters
    updateCognitiveClusters(supabase, user.id).catch(e => console.warn('Cluster update err:', e));

    return NextResponse.json({
      success: true,
      dream: {
        title: dreamResult.dream_title,
        insight: dreamResult.subconscious_insight,
        connected_entities: dreamResult.connected_entity_names,
        entry_id: newEntry.id
      }
    });
  } catch (error: any) {
    console.error('Dream synthesis error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
