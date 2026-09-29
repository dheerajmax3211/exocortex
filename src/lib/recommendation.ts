import { SupabaseClient } from '@supabase/supabase-js';
import { chatJSON } from './llm';
import { z } from 'zod';
import * as db from './db';

interface RecommendationResult {
  isRecommendation: boolean;
  content?: string;
}

const candidateSchema = z.object({
  candidates: z.array(z.object({
    title: z.string(),
    year: z.number().nullable().optional(),
    reason: z.string()
  }))
});

function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isFuzzyMatch(a: string, b: string): boolean {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;
  return false;
}

export async function checkAndHandleRecommendation(
  prompt: string,
  supabase: SupabaseClient
): Promise<RecommendationResult> {
  const lower = prompt.toLowerCase();
  
  // Detect recommendation intent and target entity type
  const isSuggestQuery = 
    lower.includes('suggest') || 
    lower.includes('recommend') || 
    lower.includes("haven't watched") || 
    lower.includes("haven't seen") || 
    lower.includes("haven't tried") || 
    lower.includes("haven't been to") || 
    lower.includes("what should i watch") || 
    lower.includes("what should i eat");

  if (!isSuggestQuery) {
    return { isRecommendation: false };
  }

  let entityType: 'movie' | 'restaurant' | 'book' | 'show' | null = null;
  if (lower.includes('movie') || lower.includes('film')) entityType = 'movie';
  else if (lower.includes('restaurant') || lower.includes('food') || lower.includes('place to eat')) entityType = 'restaurant';
  else if (lower.includes('book') || lower.includes('read')) entityType = 'book';
  else if (lower.includes('show') || lower.includes('series')) entityType = 'show';

  if (!entityType) {
    return { isRecommendation: false };
  }

  // 1. Fetch full consumed set for that type via SQL
  const consumedEntities = await db.getEntitiesByType(supabase, entityType, { limit: 1000 });
  const consumedNames = new Set<string>();
  const consumedListForTaste: string[] = [];

  for (const ent of consumedEntities) {
    consumedNames.add(normalizeName(ent.name));
    if (ent.aliases) {
      ent.aliases.forEach(a => consumedNames.add(normalizeName(a)));
    }
    const rating = ent.props?.rating_10 ? `(${ent.props.rating_10}/10)` : '';
    consumedListForTaste.push(`${ent.name} ${rating}`.trim());
  }

  // 2. Ask LLM for ~15 candidates matching taste
  const systemPrompt = `You are a personalized recommendation engine for Virtual Brain.
The user wants recommendations for ${entityType}s they haven't experienced yet.
Analyze their taste based on their recorded ${entityType} history.
Output valid JSON matching the schema with ~15 high-quality recommendations.`;

  const userTaste = consumedListForTaste.slice(0, 30).join(', ');
  const llmPrompt = `User request: "${prompt}".
User's past ${entityType}s recorded in brain: [${userTaste || 'No prior history recorded'}].
Suggest 15 varied, well-regarded ${entityType}s tailored to this taste.`;

  let totalDropped = 0;
  const finalRecommendations: { title: string; year?: number | null; reason: string }[] = [];

  try {
    const response = await chatJSON({
      system: systemPrompt,
      prompt: llmPrompt,
      schema: candidateSchema,
      temperature: 0.7
    });

    const candidates = response.candidates || [];

    // 3. Filter candidates in code against consumed set
    for (const cand of candidates) {
      const isAlreadyConsumed = Array.from(consumedNames).some(consumed => 
        isFuzzyMatch(consumed, cand.title)
      );

      if (isAlreadyConsumed) {
        totalDropped++;
      } else {
        finalRecommendations.push(cand);
      }
    }

    // 4. If fewer than 5 survive, run second round
    if (finalRecommendations.length < 5 && candidates.length > 0) {
      const alreadyProposed = candidates.map(c => c.title).join(', ');
      const followUpPrompt = `Recommend 10 more ${entityType}s. DO NOT recommend any of these: [${alreadyProposed}, ${userTaste}].`;
      
      try {
        const round2 = await chatJSON({
          system: systemPrompt,
          prompt: followUpPrompt,
          schema: candidateSchema,
          temperature: 0.8
        });

        for (const cand of round2.candidates || []) {
          const isAlreadyConsumed = Array.from(consumedNames).some(consumed => 
            isFuzzyMatch(consumed, cand.title)
          );
          if (isAlreadyConsumed) {
            totalDropped++;
          } else {
            finalRecommendations.push(cand);
          }
        }
      } catch (e) {
        // Continue with what we have
      }
    }

    // 5. Format results
    const topResults = finalRecommendations.slice(0, 8);
    let content = `### Personalized ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Recommendations\n\n`;
    
    if (topResults.length === 0) {
      content += `I couldn't find new recommendations that aren't already in your recorded history.\n\n`;
    } else {
      topResults.forEach((rec, idx) => {
        const yearStr = rec.year ? ` (${rec.year})` : '';
        content += `${idx + 1}. **${rec.title}**${yearStr}\n   ${rec.reason}\n\n`;
      });
    }

    content += `*Filtered in code against your ${consumedEntities.length} recorded ${entityType}s (${totalDropped} candidate${totalDropped === 1 ? '' : 's'} dropped as already in your memory).*`;

    return {
      isRecommendation: true,
      content
    };
  } catch (err: any) {
    console.error('Recommendation engine error:', err);
    // If LLM fails in recommendation mode, fallback to regular ask flow
    return { isRecommendation: false };
  }
}
