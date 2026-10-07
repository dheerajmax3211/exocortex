import type { ZodSchema } from 'zod';

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
  schemaDescription?: string;
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
  // Strip <think>...</think> if emitted by reasoning models
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Extract from markdown ```json ... ``` blocks if present
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Extract between first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1).trim();
  } else if (firstBrace !== -1) {
    return cleaned.slice(firstBrace).trim();
  }

  return cleaned;
}

function repairJSON(text: string): string {
  let s = cleanJSON(text);

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char === '{' ? '}' : ']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  s = s.replace(/:\s*$/, ': null');
  s = s.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  s = s.replace(/,\s*\{[^}]*$/, '');

  const finalStack: string[] = [];
  inString = false;
  escape = false;
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{' || char === '[') {
        finalStack.push(char === '{' ? '}' : ']');
      } else if (char === '}' || char === ']') {
        if (finalStack.length > 0 && finalStack[finalStack.length - 1] === char) {
          finalStack.pop();
        }
      }
    }
  }

  if (inString) s += '"';
  while (finalStack.length > 0) {
    s += finalStack.pop();
  }
  return s;
}

function parseDSMLToolCalls(content: string): { toolCalls: { id: string, name: string, args: Record<string, any> }[], cleanContent: string } {
  const toolCalls: { id: string, name: string, args: Record<string, any> }[] = [];
  let cleanContent = content;

  // Match: < | DSML | invoke name="find_entities"> ... </ | DSML | invoke>
  const invokeRegex = /<\s*\|\s*DSML\s*\|\s*invoke\s+name="([^"]+)"\s*>([\s\S]*?)(?:<\s*\/\s*\|\s*DSML\s*\|\s*invoke\s*>|$)/gi;
  let invMatch: RegExpExecArray | null;
  while ((invMatch = invokeRegex.exec(content)) !== null) {
    const toolName = invMatch[1].trim();
    const paramsContent = invMatch[2];
    const args: Record<string, any> = {};

    const paramRegex = /<\s*\|\s*DSML\s*\|\s*parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\s*\/\s*\|\s*DSML\s*\|\s*parameter\s*>/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = paramRegex.exec(paramsContent)) !== null) {
      const pName = pMatch[1].trim();
      let pVal: any = pMatch[2].trim();
      try {
        pVal = JSON.parse(pVal);
      } catch {
        // Keep as string
      }
      args[pName] = pVal;
    }

    toolCalls.push({
      id: 'call_' + Math.random().toString(36).substring(2, 10),
      name: toolName,
      args
    });
  }

  // Strip all DSML tags and markup from cleanContent
  cleanContent = cleanContent
    .replace(/<\s*\|\s*DSML\s*\|\s*calls\s*>[\s\S]*?<\s*\/\s*\|\s*DSML\s*\|\s*calls\s*>/gi, '')
    .replace(/<\s*\|\s*DSML\s*\|\s*invoke[\s\S]*?<\s*\/\s*\|\s*DSML\s*\|\s*invoke\s*>/gi, '')
    .replace(/<\s*\|\s*DSML\s*\|[\s\S]*?>/gi, '')
    .replace(/<\s*\/\s*\|\s*DSML\s*\|[\s\S]*?>/gi, '')
    .trim();

  return { toolCalls, cleanContent };
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

export function zodToCleanShape(val: any): any {
  if (!val) return "any";
  if (typeof val !== "object") return String(val);
  const def = val._def || val.def;
  if (!def) return "any";
  const type = def.typeName || def.type;
  if (type === "ZodString" || type === "string") {
    return def.description ? `string (${def.description})` : "string";
  }
  if (type === "ZodNumber" || type === "number") return "number";
  if (type === "ZodBoolean" || type === "boolean") return "boolean";
  if (type === "ZodEnum" || type === "enum") {
    const vals = def.values || (def.entries ? Object.keys(def.entries) : []);
    return vals.join(" | ");
  }
  if (type === "ZodArray" || type === "array") {
    const el = def.element || def.type || def.innerType;
    return [zodToCleanShape(el)];
  }
  if (type === "ZodNullable" || type === "nullable") {
    const inner = def.innerType || def.schema || def.element;
    const res = zodToCleanShape(inner);
    return typeof res === "object" ? res : `${res} | null`;
  }
  if (type === "ZodOptional" || type === "optional") {
    const inner = def.innerType || def.schema || def.element;
    const res = zodToCleanShape(inner);
    return typeof res === "object" ? res : `${res} (optional)`;
  }
  if (type === "ZodDefault" || type === "default") {
    const inner = def.innerType || def.schema || def.element;
    return zodToCleanShape(inner);
  }
  if (type === "ZodRecord" || type === "record") return "{ [key: string]: any }";
  if (type === "ZodObject" || type === "object") {
    const shape = typeof def.shape === "function" ? def.shape() : (val.shape || def.shape);
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(shape || {})) {
      res[k] = zodToCleanShape(v);
    }
    return res;
  }
  return "any";
}

export async function chatJSON<T>({ system, prompt, schema, schemaDescription, temperature = 0 }: ChatJSONOptions<T>): Promise<T> {
  const { provider, baseUrl, apiKey, model } = getEnvConfig();

  const schemaShape = schemaDescription || JSON.stringify(zodToCleanShape(schema), null, 2);
  const systemPrompt = `${system}\n\nYou must output a valid JSON object matching this schema:\n${schemaShape}\nDo not include markdown blocks, just the raw JSON string.`;

  let attempt = 0;
  let currentPrompt = prompt;

  while (attempt < 2) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

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

      let parsed: any;
      try {
        const jsonString = cleanJSON(content);
        parsed = JSON.parse(jsonString);
      } catch (parseErr) {
        try {
          const repaired = repairJSON(content);
          parsed = JSON.parse(repaired);
          console.warn('[chatJSON] Successfully parsed repaired/recovered JSON from model output');
        } catch (repairErr) {
          console.error('[chatJSON] Failed to parse JSON even after repair attempt. Output snippet:', content.slice(0, 300) + '...' + content.slice(-300));
          throw parseErr;
        }
      }

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
      if (attempt === 0 && (e.name === 'SyntaxError' || e.name === 'AbortError' || e.message?.includes('network'))) {
        attempt++;
        currentPrompt = `${prompt}\n\nPlease output valid, compact JSON. Avoid markdown commentary and ensure all strings and braces are properly closed.`;
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

      // DeepSeek on Command Code can stream raw DSML tool call tokens inside text-delta
      if (finalContent.includes('DSML')) {
        const { toolCalls: dsmlCalls, cleanContent } = parseDSMLToolCalls(finalContent);
        if (dsmlCalls.length > 0) {
          currentToolCalls.push(...dsmlCalls);
        }
        finalContent = cleanContent;
      }

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
      const cleaned = parseDSMLToolCalls(finalContent).cleanContent;
      return { content: cleaned, toolCalls: allToolCalls };
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
      const synthClean = parseDSMLToolCalls(finalSynthesis.content || '').cleanContent;
      if (synthClean && synthClean !== '[]') {
        return { content: synthClean, toolCalls: allToolCalls };
      }
    } catch (e) {
      console.error("[chatWithTools final synthesis error]", e);
    }
  }

  const lastMsg = currentMessages[currentMessages.length - 1];
  const rawLast = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const lastContent = parseDSMLToolCalls(rawLast).cleanContent;
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
