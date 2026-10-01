import { SupabaseClient } from '@supabase/supabase-js';
import { runSubconsciousSynthesis, MindState } from './subconscious-engine';
import { chatJSON } from './llm';
import { getOrCreateMeEntity } from './db';
import { z } from 'zod';

export interface DailyBriefing {
  vectors_summary: string;
  top_tensions: { headline: string; description: string }[];
  highest_leverage_move: string;
  generated_at: string;
}

const briefingSchema = z.object({
  vectors_summary: z.string().describe("A 1-2 sentence re-synthesis of the current Life Vectors"),
  top_tensions: z.array(z.object({
    headline: z.string(),
    description: z.string()
  })).max(2).describe("Top 1-2 emerging Cognitive Tensions"),
  highest_leverage_move: z.string().describe("The Single Highest-Leverage Move for Today")
});

export async function generateProactiveBriefing(supabase: SupabaseClient, userId: string): Promise<{ state: MindState, briefing: DailyBriefing }> {
  // First, force a fresh synthesis of the subconscious mind state
  const state = await runSubconsciousSynthesis(supabase, userId);
  
  // Then, formulate the Daily Briefing based on the fresh mind state
  const prompt = `FRESH MIND STATE:
Vectors: ${JSON.stringify(state.vectors, null, 2)}
Tensions: ${JSON.stringify(state.tensions, null, 2)}

Formulate a high-signal "Morning Consciousness Briefing" for the user.`;

  const systemPrompt = `You are the Virtual Brain Proactive Briefing module.
Distill the user's current mind state into a highly actionable morning briefing.
Identify the top 1-2 cognitive tensions and state the single highest-leverage move for today.`;

  const rawBriefing = await chatJSON({
    system: systemPrompt,
    prompt,
    schema: briefingSchema,
    temperature: 0.4
  });

  const briefing: DailyBriefing = {
    ...rawBriefing,
    generated_at: new Date().toISOString()
  };

  const me = await getOrCreateMeEntity(supabase, userId);
  
  // Save briefing into user's mind state
  const updatedMindState = {
    ...state,
    daily_briefing: briefing
  };

  await supabase.from('entities').update({
    props: {
      ...(me.props || {}),
      mind_state: updatedMindState
    }
  }).eq('id', me.id);

  return { state: updatedMindState, briefing };
}
