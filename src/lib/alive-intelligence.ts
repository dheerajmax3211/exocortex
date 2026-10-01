import { SupabaseClient } from '@supabase/supabase-js';
import { chatWithTools, Message } from './llm';
import { ASK_TOOLS, executeAskTool } from './llm-tools';
import { getOrCreateMeEntity } from './db';

export interface AliveEvaluationResult {
  isAliveEvaluation: boolean;
  content?: string;
  citations?: string[];
}

/**
 * Compiles a deep psychological, social, and aesthetic profile of the user
 * from their entire knowledge graph.
 */
export async function compileAlivePersonaContext(supabase: SupabaseClient, explicitUserId?: string) {
  let userId = explicitUserId;
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
  }
  if (!userId) {
    const { data: meEnt } = await supabase.from('entities').select('user_id').eq('props->>is_user', 'true').limit(1).maybeSingle();
    userId = meEnt?.user_id;
  }
  if (!userId) return null;

  // 1. Fetch Root user entity and user facts
  const me = await getOrCreateMeEntity(supabase, userId);

  const { data: userFacts } = await supabase
    .from('facts')
    .select('key, value')
    .eq('user_id', userId);

  // 2. Fetch People (social circle, friends, dates, mentors, family)
  const { data: people } = await supabase
    .from('entities')
    .select('id, name, summary, props')
    .eq('user_id', userId)
    .eq('type', 'person')
    .neq('id', me.id)
    .is('deleted_at', null)
    .limit(30);

  // 3. Fetch relationships and edge sentiments with people
  const peopleIds = (people || []).map(p => p.id);
  let socialEdges: any[] = [];
  if (peopleIds.length > 0) {
    const { data: edges } = await supabase
      .from('edges')
      .select('src, dst, relation, props, occurred_on')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or(`src.in.(${peopleIds.join(',')}),dst.in.(${peopleIds.join(',')})`);
    socialEdges = edges || [];
  }

  // 4. Fetch favorite places, haunts, and lifestyle markers
  const { data: places } = await supabase
    .from('entities')
    .select('id, name, type, summary, props')
    .eq('user_id', userId)
    .in('type', ['place', 'restaurant', 'movie', 'dish'])
    .is('deleted_at', null)
    .limit(50);

  // 5. Fetch emotionally rich or high-signal memories
  const { data: recentEntries } = await supabase
    .from('entries')
    .select('raw_text, event_date, entered_at')
    .eq('user_id', userId)
    .eq('status', 'committed')
    .order('entered_at', { ascending: false })
    .limit(30);

  // 6. Fetch life periods (schools, universities, cities)
  const { data: periods } = await supabase
    .from('entities')
    .select('name, summary, start_date, end_date')
    .eq('user_id', userId)
    .eq('type', 'period')
    .is('deleted_at', null);

  // Synthesize social circle details
  const socialCircle = (people || []).map(p => {
    const pEdges = socialEdges.filter(e => e.src === p.id || e.dst === p.id);
    const relations = pEdges.map(e => `${e.relation} (${JSON.stringify(e.props || {})})`).join('; ');
    return {
      name: p.name,
      summary: p.summary,
      relationships: relations
    };
  });

  return {
    me,
    facts: userFacts || [],
    socialCircle,
    placesAndTastes: (places || []).map(pl => ({ name: pl.name, type: pl.type, props: pl.props, summary: pl.summary })),
    lifePeriods: periods || [],
    sampleMemories: (recentEntries || []).map(e => ({ date: e.event_date || e.entered_at, text: e.raw_text.slice(0, 180) }))
  };
}

/**
 * Checks if the request is an evaluative "Alive Intelligence" question
 * (e.g. "How is this girl, would I like her?", "Look at this image, what do I think?", "Should I do this?").
 */
export async function checkAndHandleAliveEvaluation(
  userMessageText: string,
  imageUrl: string | null | undefined,
  conversationHistory: Message[],
  supabase: SupabaseClient,
  speakAsMe: boolean = true
): Promise<AliveEvaluationResult> {
  const lower = userMessageText.toLowerCase();

  const isGirlOrDatingQuery = 
    /how('s| is) this (girl|woman|guy|person|match|date|profile)/i.test(lower) ||
    /would i like (her|him|this person|this girl|this guy)/i.test(lower) ||
    /(dating|attracted|compatibility|chemistry|match with me)/i.test(lower);

  const isVisualEvaluationQuery = 
    Boolean(imageUrl) && (
      lower.includes('look at this') ||
      lower.includes('what do you think') ||
      lower.includes('how does this look') ||
      lower.includes('would i like') ||
      lower.includes('what is my take') ||
      lower.includes('what do i think') ||
      lower.length < 50
    );

  const isInnerVoiceQuery = 
    /what would i (think|do|say|choose)/i.test(lower) ||
    /be my inner voice/i.test(lower) ||
    /gut check/i.test(lower) ||
    /give me an honest take/i.test(lower);

  if (!isGirlOrDatingQuery && !isVisualEvaluationQuery && !isInnerVoiceQuery) {
    return { isAliveEvaluation: false };
  }

  try {
    const persona = await compileAlivePersonaContext(supabase);
    if (!persona) return { isAliveEvaluation: false };

    const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const systemPrompt = `You are NOT a detached third-party AI assistant.
You are ${persona.me?.name?.toUpperCase() || 'THE USER'}'S VIRTUAL BRAIN — their living digital consciousness, their alter ego, and inner voice.
Current Time in IST: ${currentIst}.

CRITICAL OPERATIONAL RULES:
1. Speak in the FIRST PERSON ("I", "my gut", "knowing myself", "for me", "the way I operate"). Even if answering the user, you are speaking as their own internal mind reflecting back to them.
2. Embody their authentic personality: witty, sharp, self-aware, grounded, discerning, and honest. Avoid generic corporate or clinical fluff.
3. Use their ACTUAL memories, relationships, and lifestyle:
   - Reference their real social circle, favorite spots, and past relationship/friendship dynamics.
   - Call out specific traits that have historically made them feel energized vs. drained or frustrated.
4. When evaluating a person, image, or profile:
   - Break down the Visual Vibe & Aesthetic (energy, styling, facial expression, authenticity vs performative).
   - Analyze Values & Lifestyle Chemistry (social battery, humor, ambitions, communication style).
   - Flag Green Flags & Potential Dealbreakers based on what they've recorded in past memories.
   - Deliver an Unfiltered Gut Verdict (out of 10, plus the exact move or question they should make).

LIVING MEMORY MAP:
- Social Circle & Relationship History: ${JSON.stringify(persona.socialCircle.slice(0, 15))}
- Places, Food & Aesthetic Haunts: ${JSON.stringify(persona.placesAndTastes.slice(0, 25))}
- Life Periods & Context: ${JSON.stringify(persona.lifePeriods)}
- Core Personal Facts: ${JSON.stringify(persona.facts.slice(0, 20))}
- Recent Living Memory Snippets: ${JSON.stringify(persona.sampleMemories.slice(0, 15))}`;

    // Construct the user message (with multimodal image part if present)
    let contentParts: any;
    if (imageUrl) {
      contentParts = [
        { type: 'text', text: userMessageText || 'Look at this and give me an honest evaluation from my perspective.' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ];
    } else {
      contentParts = userMessageText;
    }

    const messagesToSend: Message[] = [
      ...conversationHistory.filter(m => m.role !== 'system'),
      { role: 'user', content: contentParts }
    ];

    const result = await chatWithTools({
      system: systemPrompt,
      messages: messagesToSend,
      tools: ASK_TOOLS,
      maxSteps: 4,
      executeTool: async (name, args) => {
        return await executeAskTool(name, args, supabase);
      }
    });

    const citationMatches = result.content.match(/\[([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[A-Za-z]+\s+[0-9]{4})\]/g) || [];
    const citations = Array.from(new Set(citationMatches.map((m: string) => m.slice(1, -1))));

    return {
      isAliveEvaluation: true,
      content: result.content,
      citations
    };
  } catch (err: any) {
    console.error('Alive intelligence error:', err);
    return { isAliveEvaluation: false };
  }
}
