import { createClient } from '@/lib/supabase/server';
import { chatWithTools } from '@/lib/llm';
import { ASK_TOOLS, executeAskTool } from '@/lib/llm-tools';
import { checkAndHandleRecommendation } from '@/lib/recommendation';
import { checkAndHandleTastePrediction } from '@/lib/taste-prediction';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { messages, speak_as_me, image } = await req.json();
    const lastUserMsgObj = [...messages].reverse().find((m: any) => m.role === 'user');
    const latestUserMessage = typeof lastUserMsgObj?.content === 'string' 
      ? lastUserMsgObj.content 
      : (Array.isArray(lastUserMsgObj?.content) ? lastUserMsgObj.content.find((p: any) => p.type === 'text')?.text : '') || '';
    const imageUrl = image || lastUserMsgObj?.image;

    // 0. Check if the query is an Alive Intelligence evaluation (person, image, vibe, or inner voice)
    const { checkAndHandleAliveEvaluation } = await import('@/lib/alive-intelligence');
    const aliveResult = await checkAndHandleAliveEvaluation(
      latestUserMessage,
      imageUrl,
      messages.slice(0, -1),
      supabase,
      speak_as_me ?? true
    );
    if (aliveResult.isAliveEvaluation && aliveResult.content) {
      return new Response(JSON.stringify({
        content: aliveResult.content,
        toolCalls: [],
        citations: aliveResult.citations || [],
        isNotRecorded: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Check if the query is a "Would I like X?" taste prediction query
    const tasteResult = await checkAndHandleTastePrediction(latestUserMessage, supabase, speak_as_me);
    if (tasteResult.isTastePrediction && tasteResult.content) {
      return new Response(JSON.stringify({
        content: tasteResult.content,
        toolCalls: [],
        citations: tasteResult.citations || [],
        isNotRecorded: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Check if the query is a recommendation request with hard exclusion requirement
    const recResult = await checkAndHandleRecommendation(latestUserMessage, supabase);
    if (recResult.isRecommendation && recResult.content) {
      return new Response(JSON.stringify({
        content: recResult.content,
        toolCalls: [],
        citations: [],
        isNotRecorded: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const currentDay = new Date().toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

    const toneInstruction = speak_as_me
      ? `Tone/Perspective: Speak strictly in first-person ("I", "my") as if you are the user directly recalling your own memories (e.g. "I had pizza at...", "I visited...", "I watched...").`
      : `Tone/Perspective: Speak in second-person ("You", "your") describing the user's recorded memories (e.g. "You went to...", "You watched...").`;

    // 3. Ultra-fast Single-Shot Hybrid GraphRAG pre-fetch (<50ms)
    const { executeHybridGraphRAG, formatGraphRAGContext } = await import('@/lib/graphrag');
    const { getOrRefreshMindState } = await import('@/lib/subconscious-engine');

    const [ragResult, mindState] = await Promise.all([
      executeHybridGraphRAG(latestUserMessage, supabase),
      getOrRefreshMindState(supabase, user.id).catch(() => null)
    ]);

    const ragContext = formatGraphRAGContext(ragResult);

    const activeTensionsSummary = mindState?.tensions?.length 
      ? `ACTIVE COGNITIVE TENSIONS:\n${mindState.tensions.map(t => `- [${t.severity.toUpperCase()}] ${t.headline}: ${t.actionable_directive}`).join('\n')}`
      : '';

    const vectorsSummary = mindState?.vectors
      ? `CURRENT LIFE VECTORS (0-100): Career=${mindState.vectors.career_score}%, Finance=${mindState.vectors.finance_score}%, Fitness=${mindState.vectors.fitness_score}%, Execution=${mindState.vectors.execution_score}%, Mindset=${mindState.vectors.mindset_score}%`
      : '';

    const { getOrCreateMeEntity } = await import('@/lib/db');
    const me = await getOrCreateMeEntity(supabase, user.id);
    const userName = me?.name || 'User';

    const systemPrompt = `You are ${userName.toUpperCase()}'S VIRTUAL BRAIN — their living digital memory graph and inner voice.
Current Date/Time (IST): ${currentIst} (${currentDay}).

OPERATIONAL IDENTITY & TONE:
1. ${toneInstruction}
2. Be direct, clear, grounded, and concise. Never sound like a generic clinical chatbot or a preachy amateur therapist.
3. STRICT ACCURACY & ZERO PSYCHOANALYSIS:
   - Ground your answer strictly in the facts and relationships provided in the retrieved memory subgraph below.
   - NEVER give unsolicited psychological analyses, preachiness, or unsolicited lectures about personal motives.
   - NEVER inject unrelated personal stats (such as body weight, fitness goals, salary, or debts) into queries about travel, gear, movies, social plans, or other distinct topics.
   - If the specific "why", motivation, or detail requested is NOT in your memory graph:
     * State clearly what IS known from the records.
     * State honestly: "...but I haven't recorded the specific reason or motivation behind it yet."
     * Do NOT invent or speculate motives (e.g. do not guess "maybe it's a guilt trip").
     * Offer a quick follow-up: "If you'd like, let me know the reason and I'll save it to your memory graph."
4. If asked explicitly for strategic advice, a gut check, or a decision review, give a sharp, grounded perspective based on their stated priorities and active vectors.

${vectorsSummary ? `\n${vectorsSummary}\n` : ''}
${activeTensionsSummary ? `\n${activeTensionsSummary}\n` : ''}
${ragContext ? `\nHYBRID GRAPHRAG RETRIEVED MEMORY SUBGRAPH (<${ragResult.latencyMs}ms):\n${ragContext}\n` : ''}

RULES OF ENGAGEMENT:
- Answer directly and concisely based on retrieved memories, active life vectors, and facts.
- Cite sources inline when available as [date] (e.g. [2026-10-02]).
- Never hallucinate facts not present in the graph.`;

    const result = await chatWithTools({
      system: systemPrompt,
      messages,
      tools: ASK_TOOLS,
      maxSteps: 3,
      executeTool: async (name, args) => {
        return await executeAskTool(name, args, supabase);
      }
    });

    const citationMatches = result.content.match(/\[([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[A-Za-z]+\s+[0-9]{4})\]/g) || [];
    const citations = Array.from(new Set(citationMatches.map((m: string) => m.slice(1, -1))));

    const isNotRecorded = result.content.toLowerCase().includes("hasn't been recorded yet") || 
                          result.content.toLowerCase().includes("not been recorded yet") ||
                          result.content.toLowerCase().includes("not recorded yet");

    return new Response(JSON.stringify({
      content: result.content,
      toolCalls: result.toolCalls,
      citations,
      isNotRecorded
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Ask API error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
