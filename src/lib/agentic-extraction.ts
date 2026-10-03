import { SupabaseClient } from '@supabase/supabase-js';
import { chatWithTools } from './llm';
import { retrieveHighRecallCandidates } from './entity-resolution';

const queryGraphTool = {
  name: 'query_graph',
  description: 'Search the knowledge graph for a concept to see how it was previously mapped, what instances exist, and what edges are connected.',
  parameters: {
    type: 'object',
    properties: {
      concept: { type: 'string', description: 'The name or alias of the concept to search for' }
    },
    required: ['concept']
  }
};

const submitMutationsTool = {
  name: 'submit_graph_mutations',
  description: 'Submit the final extracted entities, edges, and facts after reasoning about the graph topology.',
  parameters: {
    type: 'object',
    properties: {
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            temp_id: { type: 'string' },
            type: { type: 'string', enum: ['person', 'place', 'item', 'event', 'concept', 'period', 'other', 'restaurant', 'dish', 'movie', 'show', 'book', 'school', 'org'] },
            name: { type: 'string' },
            aliases: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
            props: { type: 'object' },
            parent_context_temp_id: { type: 'string', description: 'ID of the parent macro-context if this is a sub-detail (Hypergraph)' },
            match: {
              type: 'object',
              properties: {
                existing_id: { type: 'string' },
                confidence: { type: 'number' }
              }
            }
          },
          required: ['temp_id', 'type', 'name']
        }
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            src_temp_id: { type: 'string' },
            dst_temp_id: { type: 'string' },
            relation: { type: 'string' },
            props: { type: 'object' },
            parent_context_temp_id: { type: 'string' }
          },
          required: ['src_temp_id', 'dst_temp_id', 'relation']
        }
      },
      facts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entity_temp_id: { type: 'string' },
            key: { type: 'string' },
            value: { type: 'string' }
          },
          required: ['entity_temp_id', 'key', 'value']
        }
      }
    },
    required: ['entities', 'edges', 'facts']
  }
};

export async function runAgenticExtraction(
  supabase: SupabaseClient,
  userId: string,
  chunk: string,
  me: any,
  systemPrompt: string
) {
  // Execute tool logic
  const executeTool = async (name: string, args: Record<string, any>) => {
    if (name === 'query_graph') {
      const candidates = await retrieveHighRecallCandidates(supabase, userId, args.concept);
      if (candidates.length === 0) return JSON.stringify({ message: 'No existing entities found for concept.' });
      
      const candidateIds = candidates.map(c => c.id);
      const { data: edges } = await supabase.from('edges').select('src, dst, relation').in('src', candidateIds).limit(50);
      
      const idToName = new Map(candidates.map(c => [c.id, c.name]));
      
      const enriched = candidates.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        state: c.props,
        linked_nodes: (edges || []).filter(e => e.src === c.id).map(e => `${e.relation} -> ${idToName.get(e.dst) || 'Unknown'}`)
      }));
      
      return JSON.stringify(enriched, null, 2);
    }
    if (name === 'submit_graph_mutations') {
      return JSON.stringify({ status: 'success', message: 'Mutations accepted. Stop and finish.' });
    }
    return JSON.stringify({ error: 'Unknown tool' });
  };

  const response = await chatWithTools({
    system: systemPrompt + '\n\nCRITICAL: Use query_graph to actively explore the graph topology if you are unsure how to branch or map entities! Once you have figured out the ontology, call submit_graph_mutations. DO NOT output JSON text directly, you MUST call submit_graph_mutations.',
    messages: [{ role: 'user', content: chunk }],
    tools: [queryGraphTool, submitMutationsTool],
    executeTool,
    maxSteps: 8
  });

  // Find the submit_graph_mutations tool call
  const submitCall = response.toolCalls.find(tc => tc.name === 'submit_graph_mutations');
  if (submitCall) {
    return submitCall.args;
  }

  // Fallback if the LLM failed to call the tool
  return { entities: [], edges: [], facts: [] };
}
