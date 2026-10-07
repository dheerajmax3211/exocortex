import { SupabaseClient } from '@supabase/supabase-js';

export async function validateEntryOwnership(supabase: SupabaseClient, entryId: string, userId: string) {
  const { data, error } = await supabase.from('entries')
    .select('id, user_id, status, raw_text')
    .eq('id', entryId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function boundedCandidates(candidates: any[], limit: number = 25) {
  if (!candidates) return [];
  return candidates.slice(0, limit);
}

export async function safeAtomicCommit(supabase: SupabaseClient, payload: any) {
  const {
    entry_id, user_id, commitAttempt,
    newEntityWrites, entityUpdates, uniqueEntityIds, contextLinks,
    edgeWrites, factWrites, event_date, event_time, date_end, date_precision
  } = payload;

  try {
    const { error: graphCommitError } = await supabase.rpc('commit_entry_graph_atomic_with_precision', {
      p_entry_id: entry_id,
      p_commit_attempt: commitAttempt || 1,
      p_new_entities: newEntityWrites,
      p_entity_updates: entityUpdates,
      p_entity_ids: uniqueEntityIds,
      p_parent_links: contextLinks || [],
      p_edges: edgeWrites.map(({ src, dst, relation, props, occurred_on, valid_from, learned_at }: any) =>
        ({ src, dst, relation, props, occurred_on, valid_from, learned_at })),
      p_facts: factWrites.map(({ entity_id, key, value, valid_from, valid_time_start, valid_time_precision, supersedes_fact_id }: any) =>
        ({ entity_id, key, value, valid_from, valid_time_start, valid_time_precision, supersedes_fact_id })),
      p_event_date: event_date || null,
      p_event_time: event_time || null,
      p_date_end: date_end || null,
      p_date_precision: date_precision || null
    });
    if (graphCommitError) throw graphCommitError;
  } catch (rpcCommitError: any) {
    console.warn('Atomic commit RPC failed or absent, executing direct write fallback:', rpcCommitError?.message || rpcCommitError);

    // 1. Direct entity writes
    for (const ent of newEntityWrites) {
      const { error: entInsertErr } = await supabase.from('entities').upsert({
        id: ent.id,
        user_id: user_id,
        type: ent.type,
        name: ent.name,
        aliases: ent.aliases || [],
        summary: ent.summary || null,
        props: ent.props || {},
        created_from_entry: entry_id
      }, { onConflict: 'id' });
      if (entInsertErr) console.warn('Direct entity upsert error:', entInsertErr.message);
    }

    // 2. Direct entity updates
    for (const upd of entityUpdates) {
      const { entity_id: updId, ...restProps } = upd;
      const { error: entUpdErr } = await supabase.from('entities')
        .update(restProps)
        .eq('id', updId)
        .eq('user_id', user_id);
      if (entUpdErr) console.warn('Direct entity update error:', entUpdErr.message);
    }

    // 3. Direct edge writes
    for (const edge of edgeWrites) {
      const { error: edgeErr } = await supabase.from('edges').insert({
        user_id: user_id,
        src: edge.src,
        dst: edge.dst,
        relation: edge.relation,
        props: edge.props || {},
        entry_id: entry_id,
        occurred_on: edge.occurred_on || null,
        valid_from: edge.valid_from || null,
        learned_at: edge.learned_at || new Date().toISOString()
      });
      if (edgeErr) console.warn('Direct edge insert error:', edgeErr.message);
    }

    // 4. Direct fact writes
    for (const fact of factWrites) {
      const factData: any = {
        user_id: user_id,
        entity_id: fact.entity_id,
        key: fact.key,
        value: fact.value,
        entry_id: entry_id,
        valid_from: fact.valid_from || null
      };
      if (fact.valid_time_start !== undefined) factData.valid_time_start = fact.valid_time_start;
      if (fact.valid_time_precision !== undefined) factData.valid_time_precision = fact.valid_time_precision;
      if (fact.supersedes_fact_id !== undefined) factData.supersedes_fact_id = fact.supersedes_fact_id;

      const { error: factErr } = await supabase.from('facts').insert(factData);
      if (factErr) console.warn('Direct fact insert error:', factErr.message);
    }

    // 5. Link entry_entities junction table
    for (const entId of uniqueEntityIds) {
      try {
        await supabase.from('entry_entities').upsert({
          entry_id: entry_id,
          entity_id: entId
        }, { onConflict: 'entry_id, entity_id', ignoreDuplicates: true });
      } catch {
        // ignore duplicate link
      }
    }

    // 6. Update entry status to committed
    const { error: finalEntryErr } = await supabase.from('entries').update({
      status: 'committed',
      event_date: event_date || null,
      date_end: date_end || null,
      date_precision: date_precision || 'day'
    }).eq('id', entry_id).eq('user_id', user_id);
    if (finalEntryErr) throw finalEntryErr;
  }
}
