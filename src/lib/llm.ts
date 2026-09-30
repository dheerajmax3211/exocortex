import { ZodSchema } from 'zod';

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | any;
  tool_call_id?: string;
  name?: string;
  tool_calls?: any[];
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: string;
}

interface ChatJSONOptions<T> {
  system: string;
  prompt: string;
  schema: ZodSchema<T>;
  temperature?: number;
}

interface ChatWithToolsOptions {
  system: string;
  messages: Message[];
  tools: ToolDef[];
  maxSteps?: number;
  executeTool?: (name: string, args: Record<string, any>) => Promise<string>;
}

interface ChatStreamOptions {
  system: string;
  messages: Message[];
  tools?: ToolDef[];
}

function getEnvConfig() {
  const provider = process.env.LLM_PROVIDER || 'openai';
  const baseUrl = process.env.LLM_BASE_URL || (provider === 'openai' ? 'https://api.deepseek.com' : 'https://api.commandcode.ai');
  const apiKey = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || (provider === 'openai' ? 'deepseek-flash' : 'deepseek/deepseek-v4-flash');

  return { provider, baseUrl, apiKey, model };
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned;
}

function formatCCMessage(msg: Message) {
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      content: [{
        type: 'tool-result',
        toolCallId: msg.tool_call_id,
        toolName: msg.name,
        output: { type: 'text', value: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }
      }]
    };
  }

  let contentParts: any[] = [];
  if (Array.isArray(msg.content)) {
    contentParts = msg.content.map((part: any) => {
      if (typeof part === 'string') return { type: 'text', text: part };
      if (part.type === 'image_url') {
        return { type: 'image', image: part.image_url?.url || '' };
      }
      if (part.type === 'tool-call') {
        return {
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input || {}
        };
      }
      return { type: 'text', text: part.text || ' ' };
    });
  } else {
    contentParts = [{ type: 'text', text: msg.content || ' ' }];
  }

  return {
    role: msg.role === 'system' ? 'user' : msg.role,
    content: contentParts
  };
}

async function runCommandCodeCompletion(messages: Message[], system: string, tools: ToolDef[], model: string, apiKey: string, temperature: number, signal: AbortSignal) {
  const params: any = {
    model: model.includes('/') ? model : `deepseek/${model}`,
    messages: messages.filter(m => m.role !== 'system').map(formatCCMessage),
    system: [{ type: 'text', text: system || ' ' }],
    max_tokens: 16000,
    temperature,
    stream: true
  };

  if (tools.length > 0) {
    params.tools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
  }

  const payload = {
    config: { workingDir: '/', date: new Date().toISOString().split('T')[0], environment: 'Node.js', structure: [], isGitRepo: false, currentBranch: '', mainBranch: 'main', gitStatus: '', recentCommits: [] },
    memory: null, taste: null, skills: null,
    permissionMode: 'standard', mode: 'agent',
    threadId: crypto.randomUUID(),
    params
  };

  const response = await fetch('https://api.commandcode.ai/alpha/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'User-Agent': 'cli',
      'x-command-code-version': '1.0.0',
      'x-cli-environment': 'production',
      'x-project-slug': 'virtual-brain',
      'x-session-id': 'sess_' + Math.random().toString(16).substring(2, 18),
      'x-taste-learning': 'false',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Command Code HTTP Error: ${response.status} ${response.statusText} - ${errBody}`);
  }

  return response;
}

export async function chatJSON<T>({ system, prompt, schema, temperature = 0 }: ChatJSONOptions<T>): Promise<T> {
  const { provider, baseUrl, apiKey, model } = getEnvConfig();

  const systemPrompt = `${system}\n\nYou must output a valid JSON object matching this schema:\n${JSON.stringify(schema, null, 2)}\nDo not include markdown blocks, just the raw JSON string.`;

  let attempt = 0;
  let currentPrompt = prompt;

  while (attempt < 2) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      let content = '';

      if (provider === 'commandcode') {
        const response = await runCommandCodeCompletion([{ role: 'user', content: currentPrompt }], systemPrompt, [], model, apiKey, temperature, controller.signal);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No readable stream");

        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.type === 'text-delta') {
                const chunk = data.textDelta ?? data.text ?? data.delta ?? (typeof data.content === 'string' ? data.content : '');
                if (chunk) content += chunk;
              }
            } catch (e) { /* skip non-JSON lines */ }
          }
        }
      } else {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: currentPrompt }
            ],
            temperature,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        content = data.choices[0]?.message?.content || '';
      }
      clearTimeout(timeout);

      if (!content) throw new Error("Empty response from LLM");

      const jsonString = cleanJSON(content);
      const parsed = JSON.parse(jsonString);

      const validation = schema.safeParse(parsed);
      if (validation.success) {
        return validation.data;
      } else {
        if (attempt === 0) {
          attempt++;
          currentPrompt = `${prompt}\n\nYour previous response was invalid JSON or did not match the schema. Validation error:\n${validation.error.message}\nFix the JSON.`;
          continue;
        }
        throw new Error(`Schema validation failed: ${validation.error.message}`);
      }
    } catch (e: any) {
      clearTimeout(timeout);
      if (attempt === 0 && e.name === 'SyntaxError') {
        attempt++;
        currentPrompt = `${prompt}\n\nYour previous response was not valid JSON. Fix the syntax.`;
        continue;
      }
      console.error("[chatJSON error]", e);
      throw e;
    }
  }

  throw new Error("Failed to get valid JSON after 2 attempts");
}

export async function chatWithTools({ system, messages, tools, maxSteps = 6, executeTool }: ChatWithToolsOptions): Promise<{ content: string; toolCalls: ToolCallResult[] }> {
  const { provider, baseUrl, apiKey, model } = getEnvConfig();

  let currentMessages: Message[] = [...messages];
  const allToolCalls: ToolCallResult[] = [];
  let steps = 0;

  while (steps < maxSteps) {
    steps++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      let finalContent = '';
      let currentToolCalls: { id: string, name: string, args: Record<string, any> }[] = [];

      if (provider === 'commandcode') {
        const response = await runCommandCodeCompletion(currentMessages, system, tools, model, apiKey, 0.3, controller.signal);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No readable stream");

        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let activeToolInput = '';
        let activeToolId = '';
        let activeToolName = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.type === 'text-delta') {
                const chunk = data.text ?? data.textDelta ?? data.delta ?? (typeof data.content === 'string' ? data.content : '');
                if (chunk) finalContent += chunk;
              } else if (data.type === 'tool-call') {
                activeToolId = data.toolCallId;
                activeToolName = data.toolName;
                activeToolInput = '';
              } else if (data.type === 'tool-input-delta' || data.type === 'tool-input-start') {
                if (data.delta) activeToolInput += data.delta;
                if (data.inputDelta) activeToolInput += data.inputDelta;
              } else if (data.type === 'finish-step' && activeToolName) {
                try {
                  const args = JSON.parse(activeToolInput || '{}');
                  currentToolCalls.push({ id: activeToolId, name: activeToolName, args });
                } catch (e) { /* skip malformed tool input */ }
              }
            } catch (e) { /* skip non-JSON lines */ }
          }
        }
      } else {
        const payload: any = {
          model,
          messages: [{ role: 'system', content: system }, ...currentMessages.map(m => {
            const formatted: any = { role: m.role, content: m.content || '' };
            if (m.name) formatted.name = m.name;
            if (m.tool_call_id) formatted.tool_call_id = m.tool_call_id;
            if (m.tool_calls) formatted.tool_calls = m.tool_calls;
            return formatted;
          })],
        };

        if (tools.length > 0) {
          payload.tools = tools.map(t => ({
            type: 'function',
            function: t
          }));
          payload.tool_choice = 'auto';
        }

        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        const message = data.choices[0]?.message;

        if (!message) throw new Error("Empty response from LLM");
        finalContent = message.content || '';

        if (message.tool_calls && message.tool_calls.length > 0) {
          currentToolCalls = message.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          }));
          currentMessages.push({ role: 'assistant', content: finalContent, tool_calls: message.tool_calls });
        } else {
          currentMessages.push({ role: 'assistant', content: finalContent });
        }
      }

      clearTimeout(timeout);

      if (currentToolCalls.length > 0) {
        if (provider === 'commandcode') {
          currentMessages.push({
            role: 'assistant',
            content: [
              ...(finalContent ? [{ type: 'text', text: finalContent }] : []),
              ...currentToolCalls.map(tc => ({
                type: 'tool-call',
                toolCallId: tc.id,
                toolName: tc.name,
                input: tc.args
              }))
            ]
          });
        }

        for (const tc of currentToolCalls) {
          const callResult: ToolCallResult = { id: tc.id, name: tc.name, args: tc.args };

          if (executeTool) {
            const result = await executeTool(tc.name, tc.args);
            callResult.result = result;
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, name: tc.name, content: result });
          }
          allToolCalls.push(callResult);
        }

        if (executeTool) continue;
        return { content: finalContent, toolCalls: allToolCalls };
      }

      // Final text answer
      return { content: finalContent, toolCalls: allToolCalls };
    } catch (e) {
      clearTimeout(timeout);
      console.error("[chatWithTools error]", e);
      throw e;
    }
  }

  // If the loop finished without generating a final text response (e.g. maxSteps reached on a tool call),
  // force one final synthesis completion with tools: [] so the model translates the tool findings into a user-facing answer!
  if (currentMessages[currentMessages.length - 1]?.role === 'tool') {
    try {
      const finalSynthesis = await chatWithTools({
        system,
        messages: currentMessages,
        tools: [],
        maxSteps: 1
      });
      if (finalSynthesis.content && finalSynthesis.content !== '[]') {
        return { content: finalSynthesis.content, toolCalls: allToolCalls };
      }
    } catch (e) {
      console.error("[chatWithTools final synthesis error]", e);
    }
  }

  const lastMsg = currentMessages[currentMessages.length - 1];
  const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  return { 
    content: (lastContent && lastContent !== '[]') ? lastContent : "I don't have any memories recorded yet. Tap the '+' button or dictate a memory to get started!", 
    toolCalls: allToolCalls 
  };
}

export async function* chatStream({ system, messages, tools }: ChatStreamOptions): AsyncGenerator<string> {
  const { provider, baseUrl, apiKey, model } = getEnvConfig();

  if (provider === 'commandcode') {
    const controller = new AbortController();
    const response = await runCommandCodeCompletion(messages, system, tools || [], model, apiKey, 0.3, controller.signal);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No readable stream");

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.type === 'text-delta') {
            const chunk = data.textDelta ?? data.text ?? data.delta ?? (typeof data.content === 'string' ? data.content : '');
            if (chunk) yield chunk;
          }
        } catch (e) { /* skip non-JSON lines */ }
      }
    }
  } else {
    const payload: any = {
      model,
      messages: [
        { role: 'system', content: system },
        ...messages
      ],
      stream: true
    };

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No readable stream");

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') return;
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices[0]?.delta?.content;
            if (delta) yield delta;
          } catch (e) { /* skip malformed SSE */ }
        }
      }
    }
  }
}
