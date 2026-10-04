require('dotenv').config({ path: '.env.local' });
const { chatWithTools } = require('./src/lib/llm.ts'); // Wait, need to compile TS to run easily, or run via ts-node.
