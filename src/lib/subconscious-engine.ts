/**
 * Autonomous Cognitive Synthesis Engine ("Subconscious Dreaming")
 * Connects dots across career, wealth, fitness, execution, and social dynamics.
 * Computes live Life Vector Scores (0-100) and detects Active Cognitive Tensions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { chatJSON } from './llm';
import { getOrCreateMeEntity } from './db';
import { z } from 'zod';

export interface LifeVectors {
  career_score: number;      // 0-100
  finance_score: number;     // 0-100
  fitness_score: number;     // 0-100
  execution_score: number;   // 0-100
  mindset_score: number;     // 0-100
  daily_thought: string;
  updated_at: string;
}

export interface CognitiveTension {
  id: string;
  dimension: 'career_wealth' | 'execution_ambition' | 'finance_debt' | 'health_vitality' | 'social_dating';
  headline: string;
  analysis: string;
  actionable_directive: string;
  severity: 'critical' | 'moderate' | 'observation';
  related_entities: string[];
}

export interface MindState {
  vectors: LifeVectors;
  tensions: CognitiveTension[];
  lastSynthesized: string;
}

const synthesisSchema = z.object({
  vectors: z.object({
    career_score: z.number().min(0).max(100).describe("Score representing alignment with career trajectory targets"),
    finance_score: z.number().min(0).max(100).describe("Score representing debt clearance and budget control"),
    fitness_score: z.number().min(0).max(100).describe("Score representing physical conditioning toward goals"),
    execution_score: z.number().min(0).max(100).describe("Score representing daily consistency vs over-planning"),
    mindset_score: z.number().min(0).max(100).describe("Score representing mental clarity and self-awareness")
  }),
  daily_thought: z.string().describe("First-person unfiltered subconscious reflection (2-3 punchy sentences) speaking directly to self"),
  tensions: z.array(z.object({
    dimension: z.enum(['career_wealth', 'execution_ambition', 'finance_debt', 'health_vitality', 'social_dating']),
    headline: z.string().describe("Sharp, incisive title of the internal conflict or challenge"),
    analysis: z.string().describe("Deep psychological and strategic breakdown connecting specific facts"),
    actionable_directive: z.string().describe("One high-leverage immediate move to resolve this tension"),
    severity: z.enum(['critical', 'moderate', 'observation']),
    related_entities: z.array(z.string()).default([])
  }))
});

/**
 * Runs the Subconscious Synthesis pipeline across the entire knowledge graph.
 */
export async function runSubconsciousSynthesis(supabase: SupabaseClient, userId: string): Promise<MindState> {
  const me = await getOrCreateMeEntity(supabase, userId);

  // 1. Fetch comprehensive memory graph snapshot
  const [entitiesRes, factsRes, edgesRes, entriesRes] = await Promise.all([
    supabase.from('entities').select('id, name, type, summary, props, start_date, end_date').eq('user_id', userId).is('deleted_at', null).limit(100),
    supabase.from('facts').select('key, value, entity_id').eq('user_id', userId).limit(150),
    supabase.from('edges').select('src, dst, relation, props').eq('user_id', userId).is('deleted_at', null).limit(100),
    supabase.from('entries').select('raw_text, event_date, entered_at').eq('user_id', userId).order('entered_at', { ascending: false }).limit(20)
  ]);

  const entities = entitiesRes.data || [];
  const facts = factsRes.data || [];
  const edges = edgesRes.data || [];
  const entries = entriesRes.data || [];

  if (entities.length <= 1 && facts.length === 0) {
    // Fresh/empty state
    return {
      vectors: {
        career_score: 50,
        finance_score: 50,
        fitness_score: 50,
        execution_score: 50,
        mindset_score: 50,
        daily_thought: "Brain is fresh and ready for input. Feed your career, financial, and personal memories to begin neural synthesis.",
        updated_at: new Date().toISOString()
      },
      tensions: [],
      lastSynthesized: new Date().toISOString()
    };
  }

  // 2. Synthesize cognitive prompt
  const factLines = facts.map(f => `${f.key}: ${f.value}`).join('\n');
  const entitySummaries = entities.map(e => `[${e.type}] ${e.name}: ${e.summary || JSON.stringify(e.props || {})}`).join('\n');
  const recentSnippets = entries.map(e => `(${e.event_date || 'date unknown'}): ${e.raw_text.slice(0, 150)}`).join('\n');

  const systemPrompt = `You are the Autonomous Cognitive Synthesis Engine ("The Subconscious Mind") of ${me.name || 'the user'}'s Virtual Brain.
You do NOT act as an external assistant. You are the deep subconscious layer of their own psyche.

YOUR MANDATE:
Analyze their entire knowledge graph across all life domains:
1. Career & Wealth: Current trajectory vs targets, modern skills vs legacy tech, and professional ambitions.
2. Finance & Debt: Cashflow management, debt payoff vs saving, budget constraints, and investment targets.
3. Fitness & Health: Current physical state vs goals, posture, habits, and workout consistency.
4. The Core Psychological Tension: Ambition vs daily execution, systems/planning vs actual boring routine.
5. Personal & Relationships: Family dynamics, friendships, dating, and connection criteria.

Compute realistic 0-100 vector alignment scores and identify 2-4 critical cognitive tensions where stated ambitions conflict with reality or behavior.
If specific facts are missing (e.g., brand-new user), gracefully synthesize based on whatever entities/facts they DO have, with sensible dynamic baselines.
Write a brutal, self-aware, highly motivating daily subconscious thought in first person ("I").`;

  const prompt = `CURRENT MEMORY GRAPH SNAPSHOT:

FACTS:
${factLines || 'No discrete facts yet'}

ENTITIES:
${entitySummaries || 'No entities yet'}

RECENT MEMORY SNIPPETS:
${recentSnippets || 'No recent entries'}

Produce the Subconscious Mind Synthesis.`;

  try {
    const synthesis = await chatJSON({
      system: systemPrompt,
      prompt,
      schema: synthesisSchema,
      temperature: 0.35
    });

    const mindState: MindState = {
      vectors: {
        ...synthesis.vectors,
        daily_thought: synthesis.daily_thought,
        updated_at: new Date().toISOString()
      },
      tensions: (synthesis.tensions || []).map((t, idx) => ({
        id: `tension-${Date.now()}-${idx}`,
        ...t
      })),
      lastSynthesized: new Date().toISOString()
    };

    // Cache to DB under special root entity props
    await supabase.from('entities').update({
      props: {
        ...(me.props || {}),
        mind_state: mindState
      }
    }).eq('id', me.id);

    return mindState;
  } catch (err: any) {
    console.error('Subconscious synthesis failed:', err);
    // Return existing cached state or sensible baseline
    const cached = me.props?.mind_state;
    if (cached) return cached;

    return {
      vectors: {
        career_score: 60,
        finance_score: 55,
        fitness_score: 45,
        execution_score: 50,
        mindset_score: 65,
        daily_thought: "I need to stop looking for new systems and execute the ones I already have.",
        updated_at: new Date().toISOString()
      },
      tensions: [],
      lastSynthesized: new Date().toISOString()
    };
  }
}

/**
 * Retrieves the current cached Mind State or runs fresh synthesis if stale (> 6 hours).
 */
export async function getOrRefreshMindState(supabase: SupabaseClient, userId: string, force = false): Promise<MindState> {
  const me = await getOrCreateMeEntity(supabase, userId);
  const cached: MindState | undefined = me.props?.mind_state;

  if (cached && !force) {
    const elapsedMs = Date.now() - new Date(cached.lastSynthesized).getTime();
    if (elapsedMs < 6 * 60 * 60 * 1000) {
      return cached;
    }
  }

  return await runSubconsciousSynthesis(supabase, userId);
}
