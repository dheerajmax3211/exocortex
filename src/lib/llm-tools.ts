import { ToolDef } from './llm';
import * as db from '@/lib/db';
import { SupabaseClient } from '@supabase/supabase-js';

export const ASK_TOOLS: ToolDef[] = [
  { 
    name: 'find_entities', 
    description: 'Fuzzy search entities by name/alias', 
    parameters: { 
      type: 'object', 
      properties: { 
        query: { type: 'string' }
      }, 
      required: ['query'] 
    } 
  },
  { 
    name: 'get_entity', 
    description: 'Get full entity details including facts, edges, and source entries', 
    parameters: { 
      type: 'object', 
      properties: { 
        id: { type: 'string', format: 'uuid' } 
      }, 
      required: ['id'] 
    } 
  },
  { 
    name: 'list_entities', 
    description: 'List entities by type with optional filters', 
    parameters: { 
      type: 'object', 
      properties: { 
        type: { type: 'string' }, 
        limit: { type: 'number' }, 
        order_by: { type: 'string' } 
      }, 
      required: ['type'] 
    } 
  },
  { 
    name: 'list_related', 
    description: 'List entities related to a given entity by relation type', 
    parameters: { 
      type: 'object', 
      properties: { 
        entity_id: { type: 'string' }, 
        relation: { type: 'string' }
      }, 
      required: ['entity_id', 'relation'] 
    } 
  },
  { 
    name: 'events_between', 
    description: 'Get events between two dates', 
    parameters: { 
      type: 'object', 
      properties: { 
        start_date: { type: 'string' }, 
        end_date: { type: 'string' } 
      }, 
      required: ['start_date', 'end_date'] 
    } 
  },
  { 
    name: 'events_on', 
    description: 'Get events on a specific date', 
    parameters: { 
      type: 'object', 
      properties: { 
        date: { type: 'string' } 
      }, 
      required: ['date'] 
    } 
  },
  { 
    name: 'search_entries', 
    description: 'Full-text search over raw entry text', 
    parameters: { 
      type: 'object', 
      properties: { 
        text: { type: 'string' } 
      }, 
      required: ['text'] 
    } 
  },
  { 
    name: 'get_entries', 
    description: 'Get entries by IDs', 
    parameters: { 
      type: 'object', 
      properties: { 
        ids: { type: 'array', items: { type: 'string' } } 
      }, 
      required: ['ids'] 
    } 
  },
  {
    name: 'get_taste_profile',
    description: 'Get comprehensive profile of what user loves, hates, ratings, quotes, and taste facts for a category (movie, restaurant, book, show, all)',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['movie', 'restaurant', 'book', 'show', 'all'] }
      },
      required: ['category']
    }
  }
];

export async function executeAskTool(toolName: string, args: Record<string, any>, supabase: SupabaseClient): Promise<string> {
  try {
    let result: any;
    
    // We optionally get the user ID for some RPC calls
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    switch (toolName) {
      case 'find_entities':
        result = await supabase.rpc('search_entities', { p_query: args.query, p_user_id: userId });
        break;
      case 'get_entity':
        result = await supabase.rpc('entity_neighborhood', { p_entity_id: args.id, p_user_id: userId });
        break;
      case 'list_entities':
        result = await db.getEntitiesByType(supabase, args.type as any, { limit: args.limit, orderBy: args.order_by });
        break;
      case 'list_related':
        result = await supabase.rpc('list_by_relation', { p_entity_id: args.entity_id, p_relation: args.relation, p_user_id: userId });
        break;
      case 'events_between':
        result = await db.eventsBetween(supabase, args.start_date, args.end_date);
        break;
      case 'events_on':
        result = await db.eventsOn(supabase, args.date);
        break;
      case 'search_entries':
        result = await db.searchEntries(supabase, args.text);
        break;
      case 'get_entries':
        result = await db.getEntries(supabase, args.ids);
        break;
      case 'get_taste_profile': {
        const { getFullTasteProfile } = await import('@/lib/taste-prediction');
        result = await getFullTasteProfile(supabase, args.category || 'all');
        break;
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    
    return JSON.stringify(result?.data || result || []);
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}
