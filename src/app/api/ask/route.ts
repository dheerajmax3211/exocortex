import { createClient } from '@/lib/supabase/server';
import { chatWithTools } from '@/lib/llm';
import { ASK_TOOLS, executeAskTool } from '@/lib/llm-tools';
import { checkAndHandleRecommendation } from '@/lib/recommendation';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { messages, speak_as_me } = await req.json();
    const latestUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    // Check if the query is a recommendation request with hard exclusion requirement
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

    const systemPrompt = `You are a memory retrieval assistant for Virtual Brain.
Current Date/Time (IST): ${currentIst} (${currentDay}).
${toneInstruction}
Answer strictly based on tool results.
Cite sources inline as [entry date] (e.g. [14 Mar 2024] or [2024-03-14]).
For list questions, return complete lists (paginate through tools rather than truncating).
For ambiguity, ask one short clarifying question.
If data is missing or not found in the graph, say clearly: "This hasn't been recorded yet." and suggest what the user could add.
Never hallucinate or invent facts.`;

    const result = await chatWithTools({
      system: systemPrompt,
      messages,
      tools: ASK_TOOLS,
      maxSteps: 6,
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
