import { SupabaseClient } from '@supabase/supabase-js'
import {
  Entry,
  Entity,
  Edge,
  Fact,
  EntryEntity,
  GraphLayout,
  EntityType
} from './types'

// --- Entry CRUD ---
export async function createEntry(supabase: SupabaseClient, entry: Partial<Entry>): Promise<Entry> {
  const { data, error } = await supabase.from('entries').insert(entry).select().single()
  if (error) throw error
  return data
}

export async function getEntry(supabase: SupabaseClient, id: string): Promise<Entry | null> {
  const { data, error } = await supabase.from('entries').select().eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function getEntries(supabase: SupabaseClient, ids: string[]): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select().in('id', ids)
  if (error) throw error
  return data
}

export async function updateEntry(supabase: SupabaseClient, id: string, updates: Partial<Entry>): Promise<Entry> {
  const { data, error } = await supabase.from('entries').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function updateEntryStatus(supabase: SupabaseClient, id: string, status: Entry['status']): Promise<Entry> {
  const { data, error } = await supabase.from('entries').update({ status }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function searchEntries(supabase: SupabaseClient, query: string): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select().textSearch('fts', query)
  if (error) throw error
  return data
}

// --- Entity CRUD ---
export async function createEntity(supabase: SupabaseClient, entity: Partial<Entity>): Promise<Entity> {
  const { data, error } = await supabase.from('entities').insert(entity).select().single()
  if (error) throw error
  return data
}

export async function getEntity(supabase: SupabaseClient, id: string): Promise<Entity | null> {
  const { data, error } = await supabase.from('entities').select().eq('id', id).is('deleted_at', null).maybeSingle()
  if (error) throw error
  return data
}

export async function getEntities(supabase: SupabaseClient, ids: string[]): Promise<Entity[]> {
  const { data, error } = await supabase.from('entities').select().in('id', ids).is('deleted_at', null)
  if (error) throw error
  return data
}

export async function updateEntity(supabase: SupabaseClient, id: string, updates: Partial<Entity>): Promise<Entity> {
  const { data, error } = await supabase.from('entities').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function softDeleteEntity(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('entities').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function searchEntities(supabase: SupabaseClient, query: string, userId?: string): Promise<Entity[]> {
  const params: any = { p_query: query }
  if (userId) params.p_user_id = userId
  const { data, error } = await supabase.rpc('search_entities', params)
  if (error) throw error
  return data || []
}

export async function getEntitiesByType(
  supabase: SupabaseClient, 
  type: EntityType, 
  options?: { limit?: number; orderBy?: string }
): Promise<Entity[]> {
  let query = supabase.from('entities').select().eq('type', type).is('deleted_at', null)
  if (options?.orderBy) {
    query = query.order(options.orderBy)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

// --- Edge CRUD ---
export async function createEdge(supabase: SupabaseClient, edge: Partial<Edge>): Promise<Edge> {
  const { data, error } = await supabase.from('edges').insert(edge).select().single()
  if (error) throw error
  return data
}

export async function getEdgesForEntity(supabase: SupabaseClient, entityId: string): Promise<Edge[]> {
  const { data, error } = await supabase.from('edges').select().or(`src.eq.${entityId},dst.eq.${entityId}`).is('deleted_at', null)
  if (error) throw error
  return data
}

export async function updateEdge(supabase: SupabaseClient, id: string, updates: Partial<Edge>): Promise<Edge> {
  const { data, error } = await supabase.from('edges').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function softDeleteEdge(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('edges').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// --- Fact CRUD ---
export async function createFact(supabase: SupabaseClient, fact: Partial<Fact>): Promise<Fact> {
  const { data, error } = await supabase.from('facts').insert(fact).select().single()
  if (error) throw error
  return data
}

export async function getFactsForEntity(supabase: SupabaseClient, entityId: string): Promise<Fact[]> {
  const { data, error } = await supabase.from('facts').select().eq('entity_id', entityId)
  if (error) throw error
  return data
}

// --- Links & Intersections ---
export async function linkEntryEntity(supabase: SupabaseClient, link: EntryEntity): Promise<EntryEntity> {
  const { data, error } = await supabase
    .from('entry_entities')
    .upsert(link, { onConflict: 'entry_id, entity_id', ignoreDuplicates: true })
    .select()
    .maybeSingle()
  if (error && error.code !== '23505') throw error
  return data as any
}

export async function getEntriesForEntity(supabase: SupabaseClient, entityId: string): Promise<Entry[]> {
  const { data, error } = await supabase.from('entry_entities').select('entries(*)').eq('entity_id', entityId)
  if (error) throw error
  return data.map((d: any) => d.entries)
}

// --- Layout ---
export async function getLayout(supabase: SupabaseClient, entityId: string): Promise<GraphLayout | null> {
  const { data, error } = await supabase.from('graph_layout').select().eq('entity_id', entityId).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertLayout(supabase: SupabaseClient, layout: Partial<GraphLayout>): Promise<GraphLayout> {
  const { data, error } = await supabase.from('graph_layout').upsert(layout).select().single()
  if (error) throw error
  return data
}

export async function deleteLayout(supabase: SupabaseClient, entityId: string): Promise<void> {
  const { error } = await supabase.from('graph_layout').delete().eq('entity_id', entityId)
  if (error) throw error
}

export async function getAllLayouts(supabase: SupabaseClient): Promise<GraphLayout[]> {
  const { data, error } = await supabase.from('graph_layout').select()
  if (error) throw error
  return data
}

// --- RPC Wrappers ---
export async function entityNeighborhood(supabase: SupabaseClient, entityId: string, userId?: string): Promise<any> {
  const params: any = { p_entity_id: entityId }
  if (userId) params.p_user_id = userId
  const { data, error } = await supabase.rpc('entity_neighborhood', params)
  if (error) throw error
  return data
}

export async function listByRelation(supabase: SupabaseClient, entityId: string, relation: string, userId?: string): Promise<any> {
  const params: any = { p_entity_id: entityId, p_relation: relation }
  if (userId) params.p_user_id = userId
  const { data, error } = await supabase.rpc('list_by_relation', params)
  if (error) throw error
  return data
}

// --- Queries ---
export async function eventsBetween(supabase: SupabaseClient, start: string, end: string): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select().gte('event_date', start).lte('event_date', end).is('status', 'committed')
  if (error) throw error
  return data
}

export async function eventsOn(supabase: SupabaseClient, date: string): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select().eq('event_date', date).is('status', 'committed')
  if (error) throw error
  return data
}

export async function getTimelineEntries(supabase: SupabaseClient): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select('*, entry_entities(entities(*))').not('event_date', 'is', null).order('event_date', { ascending: false })
  if (error) throw error
  return data
}

export async function getEntityCounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('entities').select('type', { count: 'exact' })
  if (error) throw error
  
  const counts: Record<string, number> = {}
  data.forEach(d => {
    counts[d.type] = (counts[d.type] || 0) + 1
  })
  return counts
}

// --- Advanced / Root ---
export async function getOrCreateMeEntity(supabase: SupabaseClient, userId: string): Promise<Entity> {
  // First check if an entity flagged as the user exists
  let { data: me } = await supabase
    .from('entities')
    .select()
    .eq('user_id', userId)
    .eq('props->>is_user', 'true')
    .maybeSingle()

  // Fallback to name 'Me'
  if (!me) {
    const { data: meByName } = await supabase
      .from('entities')
      .select()
      .eq('user_id', userId)
      .eq('name', 'Me')
      .maybeSingle()
    me = meByName
  }

  // Create root identity if neither exists
  if (!me) {
    const { data: newMe, error: err2 } = await supabase.from('entities').insert({
      user_id: userId,
      name: 'Me',
      type: 'person',
      aliases: ['me', 'i', 'myself'],
      summary: 'The user',
      props: { is_user: true }
    }).select().single()
    if (err2) throw err2
    me = newMe
  }
  return me
}

export async function mergeEntities(supabase: SupabaseClient, targetId: string, sourceId: string): Promise<void> {
  // repoint edges
  await supabase.from('edges').update({ src: targetId }).eq('src', sourceId)
  await supabase.from('edges').update({ dst: targetId }).eq('dst', sourceId)
  // repoint facts
  await supabase.from('facts').update({ entity_id: targetId }).eq('entity_id', sourceId)
  // repoint entry_entities
  await supabase.from('entry_entities').update({ entity_id: targetId }).eq('entity_id', sourceId)
  
  // union aliases
  const src = await getEntity(supabase, sourceId)
  const tgt = await getEntity(supabase, targetId)
  if (src && tgt) {
    const newAliases = Array.from(new Set([...(tgt.aliases || []), ...(src.aliases || [])]))
    await updateEntity(supabase, targetId, { aliases: newAliases })
  }
  
  // soft delete source
  await softDeleteEntity(supabase, sourceId)
}

export async function bulkCreateEntities(supabase: SupabaseClient, entities: Partial<Entity>[]): Promise<Entity[]> {
  const { data, error } = await supabase.from('entities').insert(entities).select()
  if (error) throw error
  return data
}

export async function bulkCreateEdges(supabase: SupabaseClient, edges: Partial<Edge>[]): Promise<Edge[]> {
  const { data, error } = await supabase.from('edges').insert(edges).select()
  if (error) throw error
  return data
}

export async function bulkCreateFacts(supabase: SupabaseClient, facts: Partial<Fact>[]): Promise<Fact[]> {
  const { data, error } = await supabase.from('facts').insert(facts).select()
  if (error) throw error
  return data
}
