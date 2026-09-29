import { SupabaseClient } from '@supabase/supabase-js';
import { chatJSON, chatStream } from './llm';
import { z } from 'zod';
import * as db from './db';

interface TastePredictionResult {
  isTastePrediction: boolean;
  content?: string;
  citations?: string[];
}

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

const queryAnalysisSchema = z.object({
  target_title: z.string().describe("The specific movie, show, restaurant, or book being asked about"),
  entity_type: z.enum(['movie', 'show', 'restaurant', 'book', 'other']).default('movie')
});

/**
 * Fetches the user's complete taste profile for an entity type,
 * categorizing memories into loved items, disliked items, quotes, and facts.
 */
export async function getFullTasteProfile(
  supabase: SupabaseClient, 
  category: 'movie' | 'show' | 'restaurant' | 'book' | 'all'
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Fetch all entities of this type
  let entityQuery = supabase
    .from('entities')
    .select('id, name, aliases, summary, props, created_at')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (category !== 'all') {
    entityQuery = entityQuery.eq('type', category);
  }

  const { data: entities } = await entityQuery;
  const entityIds = (entities || []).map(e => e.id);

  // 2. Fetch edges with ratings, sentiment, and quotes
  let edges: any[] = [];
  if (entityIds.length > 0) {
    const { data: edgeData } = await supabase
      .from('edges')
      .select('src, dst, relation, props, occurred_on')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(`src.in.(${entityIds.join(',')}),dst.in.(${entityIds.join(',')})`);
    edges = edgeData || [];
  }

  // 3. Fetch facts attached to these entities
  let facts: any[] = [];
  if (entityIds.length > 0) {
    const { data: factData } = await supabase
      .from('facts')
      .select('entity_id, key, value')
      .eq('user_id', user.id)
      .in('entity_id', entityIds);
    facts = factData || [];
  }

  // 4. Fetch general preference facts on the user
  const { data: userFacts } = await supabase
    .from('facts')
    .select('key, value')
    .eq('user_id', user.id)
    .or(`key.ilike.%taste%,key.ilike.%preference%,key.ilike.%favorite%,key.ilike.%like%,key.ilike.%dislike%`);

  // Assemble items with their consolidated rating and sentiment
  const lovedItems: any[] = [];
  const dislikedItems: any[] = [];
  const otherItems: any[] = [];

  for (const ent of entities || []) {
    const entEdges = edges.filter(e => e.src === ent.id || e.dst === ent.id);
    const entFacts = facts.filter(f => f.entity_id === ent.id);

    // Look for rating and sentiment in props or edges
    const edgeWithRating = entEdges.find(e => e.props?.rating_10 !== undefined);
    const rating = ent.props?.rating_10 ?? edgeWithRating?.props?.rating_10 ?? null;

    const edgeWithSentiment = entEdges.find(e => e.props?.sentiment);
    const sentiment = ent.props?.sentiment ?? edgeWithSentiment?.props?.sentiment ?? null;

    const quote = ent.props?.quote || entEdges.find(e => e.props?.quote)?.props?.quote || ent.summary;
    const occurredOn = entEdges.find(e => e.occurred_on)?.occurred_on;

    const item = {
      id: ent.id,
      name: ent.name,
      rating_10: rating,
      sentiment,
      quote,
      occurred_on: occurredOn,
      facts: entFacts.map(f => `${f.key}: ${f.value}`).join(', '),
      props: ent.props
    };

    if (rating >= 7.5 || sentiment === 'good') {
      lovedItems.push(item);
    } else if ((rating !== null && rating <= 5.5) || sentiment === 'bad') {
      dislikedItems.push(item);
    } else {
      otherItems.push(item);
    }
  }

  return {
    totalRecorded: (entities || []).length,
    lovedItems,
    dislikedItems,
    otherItems,
    userTasteFacts: userFacts || []
  };
}

/**
 * Checks if the prompt asks "Would I like [Movie/Restaurant/Book]?"
 * and synthesizes an authoritative taste prediction grounded in all recorded memories.
 */
export async function checkAndHandleTastePrediction(
  prompt: string,
  supabase: SupabaseClient,
  speakAsMe: boolean = false
): Promise<TastePredictionResult> {
  const lower = prompt.toLowerCase();

  // Pattern detection for taste simulation & preference prediction
  const isTasteQuery = 
    /would\s+i\s+(?:like|enjoy|love|hate|appreciate)/i.test(lower) ||
    /do\s+you\s+think\s+i(?:'d|\s+would)\s+(?:like|enjoy|love)/i.test(lower) ||
    /will\s+i\s+(?:like|enjoy|love)/i.test(lower) ||
    /is\s+(.+?)\s+something\s+i(?:'d|\s+would)\s+like/i.test(lower) ||
    /should\s+i\s+watch\s+/i.test(lower) ||
    /predict\s+if\s+i\s+(?:will|would)\s+like/i.test(lower) ||
    /how\s+does\s+(.+?)\s+fit\s+my\s+taste/i.test(lower);

  if (!isTasteQuery) {
    return { isTastePrediction: false };
  }

  try {
    // 1. Extract candidate title and entity type
    const extractionPrompt = `Extract the exact target title and entity type from the user's question: "${prompt}".
Example: "Would I like Dune: Part Two?" -> target_title: "Dune: Part Two", entity_type: "movie".
Example: "Do you think I'd enjoy Past Lives?" -> target_title: "Past Lives", entity_type: "movie".
Example: "Would I like eating at Nagarjuna?" -> target_title: "Nagarjuna", entity_type: "restaurant".`;

    const parsed = await chatJSON({
      system: 'You extract the target title and category from preference questions. Respond in JSON.',
      prompt: extractionPrompt,
      schema: queryAnalysisSchema
    });

    const targetTitle = parsed.target_title;
    const entityType = parsed.entity_type;

    if (!targetTitle) {
      return { isTastePrediction: false };
    }

    // 2. Check if the user ALREADY recorded this item in their brain!
    const { data: matches } = await supabase.rpc('search_entities', {
      p_query: targetTitle
    });

    const existingMatch = (matches || []).find((m: any) => 
      isFuzzyMatch(m.name, targetTitle) || 
      (m.aliases && m.aliases.some((a: string) => isFuzzyMatch(a, targetTitle)))
    );

    if (existingMatch) {
      // The user already experienced this item!
      const { data: neighborhood } = await supabase.rpc('entity_neighborhood', {
        p_entity_id: existingMatch.id
      });

      const edges = neighborhood?.edges_in?.concat(neighborhood?.edges_out || []) || [];
      const ratingEdge = edges.find((e: any) => e.props?.rating_10 !== undefined);
      const rating = existingMatch.props?.rating_10 ?? ratingEdge?.props?.rating_10;
      const sentiment = existingMatch.props?.sentiment ?? edges.find((e: any) => e.props?.sentiment)?.props?.sentiment;
      const quote = existingMatch.props?.quote || edges.find((e: any) => e.props?.quote)?.props?.quote || existingMatch.summary;
      const date = ratingEdge?.occurred_on || existingMatch.created_at;
      const formattedDate = date ? new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' }) : 'in the past';

      const citations = date ? [formattedDate] : [];

      let content = '';
      if (speakAsMe) {
        content = `### 🎬 I've Already Experienced **${existingMatch.name}**\n\n`;
        content += `I already recorded this memory on **${formattedDate}**.\n\n`;
        if (rating) content += `- **My Rating**: **${rating}/10**\n`;
        if (sentiment) content += `- **My Recorded Sentiment**: ${sentiment.toUpperCase()}\n`;
        if (quote) content += `- **What I Said**: *"${quote}"*\n\n`;
        content += `So I don't need to guess — I already know: I ${rating >= 7.5 ? 'loved' : rating <= 5 ? 'disliked' : 'had mixed feelings about'} it!`;
      } else {
        content = `### 🎬 You've Already Experienced **${existingMatch.name}**\n\n`;
        content += `This is already recorded in your memory graph from **${formattedDate}**.\n\n`;
        if (rating) content += `- **Your Rating**: **${rating}/10**\n`;
        if (sentiment) content += `- **Your Recorded Sentiment**: ${sentiment.toUpperCase()}\n`;
        if (quote) content += `- **What You Said**: *"${quote}"*\n\n`;
        content += `So you don't have to wonder: you ${rating >= 7.5 ? 'loved' : rating <= 5 ? 'disliked' : 'had mixed feelings about'} it!`;
      }

      return {
        isTastePrediction: true,
        content,
        citations
      };
    }

    // 3. Not experienced yet: Fetch full taste profile
    const profile = await getFullTasteProfile(supabase, entityType as any);

    if (!profile || profile.totalRecorded === 0) {
      return {
        isTastePrediction: true,
        content: `I don't have enough recorded ${entityType}s in your memory graph yet to accurately predict your taste. Once you record 3 to 5 ${entityType}s with what you loved or disliked about them, I'll be able to simulate your critical preferences with precision!`,
        citations: []
      };
    }

    // 4. Synthesize Taste Simulation using LLM
    const perspectiveRule = speakAsMe
      ? `Tone: First-person ("Based on my recorded taste, I would likely...", "I loved...", "What might bother me is...").`
      : `Tone: Second-person ("Based on your recorded taste, you would likely...", "You loved...", "What might bother you is...").`;

    const systemPrompt = `You are Virtual Brain's Personal Taste Simulation Engine — a digital replica of the user's aesthetic, narrative, and critical taste.
${perspectiveRule}
Your goal is to decide whether the user will like the candidate item based on EVERYTHING the virtual brain knows about their taste.

DECISION PROTOCOL:
1. Deconstruct the target title: identify its genre, director, themes, tone, pacing, and stylistic markers.
2. Directly contrast it with the user's RECORDED FAVORITES (items rated 8-10 or sentiment 'good') and RECORDED DISLIKES (items rated <=5 or sentiment 'bad').
3. Cite specific real items from their memory graph to justify your decision.
4. Structure your response into:
   - **Projected Verdict & Predicted Score** (e.g. "⭐ Strong Yes — Projected 8.5/10", "⚠️ High Variance / Mixed ~6.5/10", "❌ Likely Skip ~4/10")
   - **Taste DNA Alignment (Why It Fits)**: Specific parallels to things they loved in their memory.
   - **Friction Points & Risk Factors (What Might Bug You)**: Potential elements that clash with things they previously complained about.
   - **The Litmus Test**: One decisive sentence that determines whether they will love it or hate it.`;

    const userPrompt = `Target ${entityType.toUpperCase()}: "${targetTitle}"

USER'S RECORDED TASTE DATA (${profile.totalRecorded} items recorded in brain):

🟢 HIGHLY RATED / LOVED ITEMS:
${JSON.stringify(profile.lovedItems.map(i => ({ name: i.name, rating: i.rating_10, quote: i.quote, facts: i.facts })), null, 2)}

🔴 LOW RATED / DISLIKED ITEMS:
${JSON.stringify(profile.dislikedItems.map(i => ({ name: i.name, rating: i.rating_10, quote: i.quote, facts: i.facts })), null, 2)}

⚪ OTHER RECORDED ITEMS:
${profile.otherItems.slice(0, 15).map(i => `${i.name} (${i.rating_10 ? i.rating_10 + '/10' : 'unrated'})`).join(', ')}

GENERAL TASTE FACTS:
${JSON.stringify(profile.userTasteFacts, null, 2)}

Evaluate whether the user would like "${targetTitle}". Be decisive, analytical, and deeply grounded in their recorded memories.`;

    const result = await chatJSON({
      system: systemPrompt + '\nRespond in JSON format with fields: verdict, predicted_score, why_you_will_like, friction_points, litmus_test, informed_by_titles (array of titles from the user history used in comparison).',
      prompt: userPrompt,
      schema: z.object({
        verdict: z.string(),
        predicted_score: z.string(),
        why_you_will_like: z.array(z.string()),
        friction_points: z.array(z.string()),
        litmus_test: z.string(),
        informed_by_titles: z.array(z.string()).default([])
      }),
      temperature: 0.3
    });

    // 5. Format into an authoritative analysis card
    let formatted = `### 🎬 Taste Simulation: **${targetTitle}**\n\n`;
    formatted += `> **Verdict**: **${result.verdict}** (${result.predicted_score})\n\n`;

    formatted += `#### ✨ Taste DNA Alignment\n`;
    for (const point of result.why_you_will_like) {
      formatted += `- ${point}\n`;
    }
    formatted += `\n`;

    if (result.friction_points && result.friction_points.length > 0) {
      formatted += `#### ⚠️ Potential Friction Points\n`;
      for (const friction of result.friction_points) {
        formatted += `- ${friction}\n`;
      }
      formatted += `\n`;
    }

    formatted += `#### 🎯 The Litmus Test\n`;
    formatted += `*${result.litmus_test}*\n\n`;

    if (result.informed_by_titles && result.informed_by_titles.length > 0) {
      formatted += `*Grounded against your recorded memories of: ${result.informed_by_titles.join(', ')}.*`;
    }

    return {
      isTastePrediction: true,
      content: formatted,
      citations: result.informed_by_titles
    };
  } catch (error: any) {
    console.error('Taste prediction error:', error);
    return { isTastePrediction: false };
  }
}
