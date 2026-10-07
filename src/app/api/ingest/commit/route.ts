import { ServerTiming } from "@/lib/server/timing";
import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { placeNewEntity } from '@/lib/graph/layout';
import { isDomainHubName } from '@/lib/graph-hierarchy';
import { resolveEntitiesBatch, generateClarificationQuestions } from '@/lib/entity-resolution';

export async function POST(req: Request) {
  const timing = new ServerTiming();
  try {
    timing.start('total_commit');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entry_id, entities, edges, facts, event_date } = body;

    if (!entry_id) {
      return NextResponse.json({ error: 'entry_id is required' }, { status: 400 });
    }

    timing.start('entity_resolution');
    const meEntity = await db.getOrCreateMeEntity(supabase, user.id);
    const entityIdMap: Record<string, string> = {
      me: meEntity.id,
      Me: meEntity.id,
      ME: meEntity.id
    };
    if (meEntity.name) {
      entityIdMap[meEntity.name.toLowerCase()] = meEntity.id;
    }
    for (const a of meEntity.aliases || []) {
      entityIdMap[a.toLowerCase()] = meEntity.id;
    }

    const createdEntities: string[] = [];

    // Fetch existing entities in graph for resolution
    const { data: dbEntities } = await supabase
      .from('entities')
      .select('id, name, type, aliases, summary, props, start_date, end_date')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const activeEntities: any[] = [...(dbEntities || [])];

    const ambiguousMatches: any[] = [];
    const clarificationQuestions: string[] = [];

    // Pre-resolve batch entities
    const entitiesToResolve = (entities || []).filter((ent: any) => {
      const isMe =
        ent.temp_id?.toLowerCase() === 'me' ||
        ent.name?.toLowerCase() === 'me' ||
        ent.name?.toLowerCase() === meEntity.name?.toLowerCase() ||
        (meEntity.aliases || []).some((a: string) => a.toLowerCase() === ent.name?.toLowerCase()) ||
        ent.match?.existing_id === meEntity.id;

      const modelMatchId = ent.match?.existing_id;
      const hasValidModelMatch = modelMatchId && ent.match?.confidence && ent.match.confidence > 0.8 && activeEntities.some(e =>
        e.id === modelMatchId && (!ent.type || e.type === ent.type)
      );

      return !isMe && !hasValidModelMatch;
    });

    const batchResults = resolveEntitiesBatch(
      entitiesToResolve,
      edges || [],
      activeEntities
    );

    const newEntitiesToInsert: any[] = [];
    const entityUpdates: any[] = [];

    // 1. Process entities
    for (const ent of entities || []) {
      const isMe =
        ent.temp_id?.toLowerCase() === 'me' ||
        ent.name?.toLowerCase() === 'me' ||
        ent.name?.toLowerCase() === meEntity.name?.toLowerCase() ||
        (meEntity.aliases || []).some(a => a.toLowerCase() === ent.name?.toLowerCase()) ||
        ent.match?.existing_id === meEntity.id;

      if (isMe) {
        entityIdMap[ent.temp_id] = meEntity.id;
        const updates: any = {};
        if (ent.name && ent.name.toLowerCase() !== 'me' && (!meEntity.name || meEntity.name === 'Me')) {
          updates.name = ent.name;
        }
        if (ent.aliases && ent.aliases.length > 0) {
          updates.aliases = Array.from(new Set([...(meEntity.aliases || []), ...ent.aliases, ent.name].filter(Boolean)));
        }
        if (ent.props && Object.keys(ent.props).length > 0) {
          updates.props = { ...(meEntity.props || {}), is_user: true, ...ent.props };
        }
        if (Object.keys(updates).length > 0) {
          entityUpdates.push({ id: meEntity.id, props: updates });
        }
        continue;
      }

      let matchedExistingId: string | null = null;
      let matchedExistingEntity: any = null;

      if (ent.match?.existing_id && ent.match.confidence > 0.8) {
        matchedExistingId = ent.match.existing_id;
        matchedExistingEntity = activeEntities.find(e => e.id === matchedExistingId);
      } else {
        const resolution = batchResults[ent.temp_id];
        if (resolution) {
          if (resolution.matchType === 'ambiguous') {
            ambiguousMatches.push({
              temp_id: ent.temp_id,
              entity: ent,
              candidates: resolution.ambiguousCandidates
            });
            clarificationQuestions.push(...generateClarificationQuestions(resolution));
          } else if (resolution.confidence >= 0.85) {
            matchedExistingId = resolution.matchedId;
            matchedExistingEntity = resolution.existingEntity;
          }
        }
      }

      if (matchedExistingId) {
        entityIdMap[ent.temp_id] = matchedExistingId;
        const updates: any = {};
        if (ent.props && Object.keys(ent.props).length > 0) {
          updates.props = { ...(matchedExistingEntity?.props || {}), ...ent.props };
        }
        if (ent.summary && (!matchedExistingEntity?.summary || ent.summary.length > matchedExistingEntity.summary.length)) {
          updates.summary = ent.summary;
        }
        if (ent.aliases && ent.aliases.length > 0) {
          updates.aliases = Array.from(new Set([...(matchedExistingEntity?.aliases || []), ...ent.aliases]));
        }
        if (ent.props?.date || ent.props?.start_date) {
          updates.start_date = ent.props.start_date || ent.props.date;
        }
        if (ent.props?.end_date) {
          updates.end_date = ent.props.end_date;
        }
        if (Object.keys(updates).length > 0) {
          entityUpdates.push({ id: matchedExistingId, props: updates });
        }
      } else {
        const newId = crypto.randomUUID();
        entityIdMap[ent.temp_id] = newId;
        createdEntities.push(newId);

        const newRecord = {
          id: newId,
          user_id: user.id,
          type: ent.type,
          name: ent.name,
          aliases: ent.aliases || [],
          summary: ent.summary || null,
          props: ent.props || {},
          created_from_entry: entry_id
        };
        newEntitiesToInsert.push(newRecord);
        activeEntities.push(newRecord);
      }
    }
    timing.end('entity_resolution');

    // 2. Process edges with Anti-Bypass Guard
    timing.start('graph_commit');
    const entitiesWithParents = new Set<string>();
    for (const edge of edges || []) {
      const s = entityIdMap[edge.src_temp_id];
      const d = entityIdMap[edge.dst_temp_id];
      if (s && d && s !== meEntity.id) {
        entitiesWithParents.add(d);
      }
    }

    const isPermittedRootAnchor = (ent: any): boolean => {
      if (!ent) return false;
      if (ent.props?.is_domain_hub || isDomainHubName(ent.name)) return true;
      if (ent.type === 'person' && /parents|mother|father|mom|dad|wife|husband|brother|sister/i.test(ent.name)) return true;
      if (ent.type === 'org' && /neustar|transunion/i.test(ent.name)) return true;
      if (ent.type === 'place' && /bangalore|bengaluru|karnataka/i.test(ent.name)) return true;
      if (ent.type === 'event' && /trip|vacation|wedding|graduation|birth/i.test(ent.name)) return true;
      if (ent.name?.toLowerCase().includes('reflection') || ent.name?.toLowerCase().includes('reset')) return true;
      return false;
    };

    const edgeWrites: any[] = [];
    const bypassFacts: any[] = [];

    for (const edge of edges || []) {
      const srcId = entityIdMap[edge.src_temp_id];
      const dstId = entityIdMap[edge.dst_temp_id];
      if (!srcId || !dstId || srcId === dstId) continue;

      const isDirectMeEdge = srcId === meEntity.id || dstId === meEntity.id;
      if (isDirectMeEdge) {
        const otherId = srcId === meEntity.id ? dstId : srcId;
        const otherEntity = activeEntities.find(e => e.id === otherId);

        if (otherEntity && (entitiesWithParents.has(otherId) || !isPermittedRootAnchor(otherEntity))) {
          if (edge.relation && !['explores', 'passionate_about', 'aiming_for', 'has_preference', 'enjoys', 'trains', 'works_in', 'manages', 'travels_to', 'reflected_on'].includes(edge.relation)) {
            bypassFacts.push({
              user_id: user.id,
              entity_id: otherId,
              key: 'status',
              value: edge.relation,
              entry_id: entry_id
            });
          }
          continue;
        }
      }

      edgeWrites.push({
        user_id: user.id,
        src: srcId,
        dst: dstId,
        relation: edge.relation,
        props: edge.props || {},
        entry_id: entry_id,
        occurred_on: event_date || null,
        valid_from: event_date || null,
        learned_at: new Date().toISOString()
      });
    }

    // 3. Process facts
    const factWrites: any[] = [...bypassFacts];
    for (const fact of facts || []) {
      const entityId = entityIdMap[fact.entity_temp_id];
      if (entityId) {
        factWrites.push({
          user_id: user.id,
          entity_id: entityId,
          key: fact.key,
          value: fact.value,
          entry_id: entry_id,
          valid_from: fact.valid_from || event_date || null,
          valid_time_start: fact.valid_time_start || null,
          valid_time_precision: fact.valid_time_precision || 'unknown',
          supersedes_fact_id: fact.supersedes_fact_id || null
        });
      }
    }

    // 4. Link entry_entities
    const uniqueEntityIds = Array.from(new Set(Object.values(entityIdMap).filter(Boolean)));
    if (event_date && !uniqueEntityIds.includes(meEntity.id)) {
      uniqueEntityIds.push(meEntity.id);
    }

    const junctionWrites = uniqueEntityIds.map(realId => ({
      entry_id: entry_id,
      entity_id: realId
    }));

    // BATCH DATABASE WRITES (parallel, minimal network round-trips)
    await Promise.all([
      newEntitiesToInsert.length > 0
        ? supabase.from('entities').insert(newEntitiesToInsert)
        : Promise.resolve({ error: null }),
      edgeWrites.length > 0
        ? supabase.from('edges').insert(edgeWrites)
        : Promise.resolve({ error: null }),
      factWrites.length > 0
        ? supabase.from('facts').insert(factWrites)
        : Promise.resolve({ error: null }),
      junctionWrites.length > 0
        ? supabase.from('entry_entities').upsert(junctionWrites, { onConflict: 'entry_id, entity_id', ignoreDuplicates: true })
        : Promise.resolve({ error: null }),
      ...entityUpdates.map(u =>
        supabase.from('entities').update(u.props).eq('id', u.id).eq('user_id', user.id)
      ),
      supabase.from('entries').update({
        status: 'committed',
        event_date: event_date || null
      }).eq('id', entry_id).eq('user_id', user.id)
    ]);

    timing.end('graph_commit');
    timing.end('total_commit');

    // 5. Enrichment in background: embeddings, force-layout, clusters, alter-ego synthesis
    after(async () => {
      // Background embedding generation for new entities
      if (newEntitiesToInsert.length > 0) {
        try {
          const { getEmbedding } = await import('@/lib/embeddings');
          await Promise.all(newEntitiesToInsert.map(async ent => {
            try {
              const embedding = await getEmbedding(`${ent.name} (${ent.type}): ${ent.summary || ''}`);
              await supabase.from('entities').update({ embedding }).eq('id', ent.id).eq('user_id', user.id);
            } catch (err) {
              console.warn('Background embedding update failed for', ent.name, err);
            }
          }));
        } catch (e) {
          console.warn('Embedding module import error:', e);
        }
      }

      // Background force layout
      for (const newId of createdEntities) {
        try {
          const newEdges = (edges || []).filter((e: any) =>
            entityIdMap[e.src_temp_id] === newId || entityIdMap[e.dst_temp_id] === newId
          ).map((e: any) => ({
            src: entityIdMap[e.src_temp_id],
            dst: entityIdMap[e.dst_temp_id]
          }));
          await placeNewEntity(supabase, newId, newEdges, user.id);
        } catch (e) {
          console.warn('Background layout placement failed for', newId, e);
        }
      }

      // Background cognitive clustering
      const { updateCognitiveClusters } = await import('@/lib/community-clustering');
      await updateCognitiveClusters(supabase, user.id).catch(e => console.warn('Cluster update err:', e));

      // Background subconscious alter-ego synthesis
      const { runSubconsciousSynthesis } = await import('@/lib/subconscious-engine');
      await runSubconsciousSynthesis(supabase, user.id).catch(e => console.warn('Subconscious synthesis err:', e));
    });

    const res = NextResponse.json({
      success: true,
      createdEntities,
      ambiguousMatches,
      clarificationQuestions
    });
    res.headers.set("Server-Timing", timing.getHeader());
    return res;
  } catch (error: any) {
    console.error('Commit error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
