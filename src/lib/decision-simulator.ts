/**
 * Decision & "What-If" Scenario Simulator Engine
 * Simulates high-stakes life, career, financial, and personal decisions
 * strictly grounded against the user's real knowledge graph constraints.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { chatJSON } from './llm';
import { compileAlivePersonaContext } from './alive-intelligence';
import { z } from 'zod';

export interface DecisionSimulationResult {
  scenario: string;
  verdict: string;
  success_probability: number; // 0-100%
  financial_impact: string;
  career_trajectory: string;
  wellbeing_and_psychology: string;
  tactical_steps: string[];
  blindspots: string[];
  alter_ego_quote: string;
  timestamp: string;
}

const simulationSchema = z.object({
  verdict: z.string().describe("Clear, definitive decision verdict: 'RECOMMENDED GREEN LIGHT', 'CONDITIONAL GO', or 'HIGH RISK CAUTION' with core rationale"),
  success_probability: z.number().min(0).max(100).describe("Realistic percentage chance of achieving desired outcome based on real historical consistency"),
  financial_impact: z.string().describe("Detailed breakdown of cash flow, debt clearance, and savings impact"),
  career_trajectory: z.string().describe("Impact on reaching career targets, modern tech stack vs legacy code, and mobility"),
  wellbeing_and_psychology: z.string().describe("Impact on mental stress, consistency, habits, and family/social life"),
  tactical_steps: z.array(z.string()).describe("3-5 concrete tactical moves to execute this scenario safely"),
  blindspots: z.array(z.string()).describe("2-3 uncomfortable truths or hidden risks the user is glossing over"),
  alter_ego_quote: z.string().describe("A poignant, witty, unfiltered quote from their own inner consciousness evaluating the choice")
});

/**
 * Executes a deep multi-factor decision simulation.
 */
export async function simulateScenario(
  scenario: string,
  supabase: SupabaseClient,
  userId?: string
): Promise<DecisionSimulationResult> {
  const persona = await compileAlivePersonaContext(supabase, userId);
  if (!persona) {
    throw new Error('User context not available for simulation');
  }

  const systemPrompt = `You are the High-Stakes Decision Simulator of ${persona.me.name || 'the user'}'s Virtual Brain.
Your role is to run a rigorous, brutally honest, multi-domain simulation of a scenario ${persona.me.name || 'the user'} is contemplating.

GROUNDING FACTS (DO NOT INVENT DIFFERENT REALITIES):
- Identity: ${persona.me.name || 'The User'}. ${persona.me.summary || ''}
- Core Facts: ${persona.facts.length ? persona.facts.map((f: any) => f.key + ': ' + f.value).join('; ') : 'No specific facts known.'}
- Social Context: ${persona.socialCircle.length ? persona.socialCircle.map((p: any) => p.name).join(', ') : 'Unknown.'}
- Lifestyle & Preferences: ${persona.placesAndTastes.length ? persona.placesAndTastes.map((p: any) => p.name).join(', ') : 'Unknown.'}
- Recent Memories: ${persona.sampleMemories.length ? persona.sampleMemories.map((m: any) => m.text).join(' | ') : 'No recent memories.'}
- Baseline: If specific facts (like salary, weight, or habits) are missing, gracefully evaluate based on whatever information is available with sensible defaults for a professional adult.

INSTRUCTIONS:
1. Pressure-test the scenario against their ACTUAL numbers and psychological tendencies extracted from the facts.
2. Be brutally realistic about execution: If a plan assumes massive sudden behavior changes, call it out based on past track record.
3. Calculate an honest success probability (0-100%).
4. Deliver an unfiltered Alter-Ego Verdict that feels like their highest-clarity self speaking back to them.`;

  const prompt = `SCENARIO TO SIMULATE:
"${scenario}"

Run the full decision simulation.`;

  const sim = await chatJSON({
    system: systemPrompt,
    prompt,
    schema: simulationSchema,
    temperature: 0.3
  });

  return {
    scenario,
    verdict: sim.verdict,
    success_probability: sim.success_probability,
    financial_impact: sim.financial_impact,
    career_trajectory: sim.career_trajectory,
    wellbeing_and_psychology: sim.wellbeing_and_psychology,
    tactical_steps: sim.tactical_steps,
    blindspots: sim.blindspots,
    alter_ego_quote: sim.alter_ego_quote,
    timestamp: new Date().toISOString()
  };
}
