/**
 * Test script for verifying the configured LLM provider (Command Code or DeepSeek/OpenAI).
 * Tests:
 *  (a) Plain chat completion
 *  (b) Strict JSON output with Zod validation
 *  (c) Tool / function calling
 * 
 * Usage:
 *  npx tsx scripts/test-llm.ts
 */

import { chatJSON, chatWithTools, chatStream } from '../src/lib/llm';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local if present
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const testSchema = z.object({
  greeting: z.string(),
  model_understood: z.boolean(),
  number_squared: z.number()
});

async function runTests() {
  console.log('==============================================');
  console.log('Testing LLM Provider Configuration');
  console.log(`Provider: ${process.env.LLM_PROVIDER || 'openai'}`);
  console.log(`Base URL: ${process.env.LLM_BASE_URL || '(default)'}`);
  console.log(`Model:    ${process.env.LLM_MODEL || '(default)'}`);
  console.log(`API Key:  ${process.env.LLM_API_KEY ? 'Present (' + process.env.LLM_API_KEY.slice(0, 8) + '...)' : 'MISSING'}`);
  console.log('==============================================\n');

  if (!process.env.LLM_API_KEY) {
    console.error('❌ Error: LLM_API_KEY is not set in environment or .env.local.');
    console.error('Please configure your API key before running this test.');
    process.exit(1);
  }

  // Test (a): Plain Chat / Stream
  console.log('--- Test (a): Plain Chat Stream ---');
  try {
    const generator = chatStream({
      system: 'You are a concise AI assistant. Respond in one short sentence.',
      messages: [{ role: 'user', content: 'Say hello and state your model name.' }]
    });

    process.stdout.write('Output: ');
    for await (const chunk of generator) {
      process.stdout.write(chunk);
    }
    console.log('\n✅ Test (a) Passed!\n');
  } catch (err: any) {
    console.error('❌ Test (a) Failed:', err.message);
  }

  // Test (b): Strict JSON Output
  console.log('--- Test (b): Strict JSON Output (Zod Schema) ---');
  try {
    const result = await chatJSON({
      system: 'You are an assistant that only responds in valid json.',
      prompt: 'Provide a greeting, confirm you understand, and calculate 7 squared.',
      schema: testSchema
    });
    console.log('Parsed JSON Result:', result);
    if (result.number_squared === 49) {
      console.log('✅ Test (b) Passed (Correct JSON and calculation)!\n');
    } else {
      console.log('⚠️ Test (b) Passed schema, but number_squared was', result.number_squared, '\n');
    }
  } catch (err: any) {
    console.error('❌ Test (b) Failed:', err.message);
  }

  // Test (c): Tool / Function Calling
  console.log('--- Test (c): Tool / Function Calling ---');
  try {
    const tools = [
      {
        name: 'get_current_weather',
        description: 'Get weather for a city',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string' }
          },
          required: ['city']
        }
      }
    ];

    const result = await chatWithTools({
      system: 'You are a helpful assistant with access to tools.',
      messages: [{ role: 'user', content: 'What is the weather in Bengaluru?' }],
      tools,
      executeTool: async (name, args) => {
        console.log(` -> Executing Tool: ${name} with args:`, args);
        return JSON.stringify({ temperature: '24°C', condition: 'Pleasant and partly cloudy' });
      }
    });

    console.log('Final Assistant Answer:', result.content);
    console.log('Tool Calls Recorded:', result.toolCalls.length);
    console.log('✅ Test (c) Passed!\n');
  } catch (err: any) {
    console.error('❌ Test (c) Failed:', err.message);
  }

  console.log('==============================================');
  console.log('All tests finished.');
  console.log('==============================================');
}

runTests().catch(console.error);
