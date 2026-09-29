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

    const { messages } = await req.json();
    const latestUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    // Check if the query is a recommendation request with hard exclusion requirement
    const recResult = await checkAndHandleRecommendation(latestUserMessage, supabase);
    if (recResult.isRecommendation && recResult.content) {
      return new Response(JSON.stringify({
        content: recResult.content,
        toolCalls: []
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const currentDay = new Date().toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

    const systemPrompt = `You are a memory retrieval assistant for Virtual Brain.
Current Date/Time (IST): ${currentIst} (${currentDay}).
Answer strictly based on tool results.
Cite sources as [entry date] links to the source entry.
For list questions, return complete lists (paginate through tools rather than truncating).
For ambiguity, ask one short clarifying question.
If data is missing, say "This hasn't been recorded yet" and suggest what the user could add.
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

    return new Response(JSON.stringify({
      content: result.content,
      toolCalls: result.toolCalls
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Ask API error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
