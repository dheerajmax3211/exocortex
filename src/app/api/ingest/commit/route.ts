import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { placeNewEntity } from '@/lib/graph/layout';

export async function POST(req: Request) {
  try {
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

    const createdEntities = [];

    // Fetch existing entities in graph for entity resolution guard
    const { data: dbEntities } = await supabase
      .from('entities')
      .select('id, name, type, aliases, summary, props, start_date, end_date')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const activeEntities: any[] = [...(dbEntities || [])];
    const { resolveEntityMatch } = await import('@/lib/entity-resolution');

    // 1. Process entities with intelligent resolution
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
          await db.updateEntity(supabase, meEntity.id, updates);
        }
        continue;
      }

      // Check if LLM matched it or resolve via Entity Resolution algorithm
      let matchedExistingId: string | null = null;
      let matchedExistingEntity: any = null;

      if (ent.match?.existing_id && ent.match.confidence > 0.8) {
        matchedExistingId = ent.match.existing_id;
        matchedExistingEntity = activeEntities.find(e => e.id === matchedExistingId);
      } else {
        const resolution = resolveEntityMatch(ent, activeEntities);
        if (resolution && resolution.confidence >= 0.85) {
          matchedExistingId = resolution.matchedId;
          matchedExistingEntity = resolution.existingEntity;
        }
      }

      if (matchedExistingId) {
        entityIdMap[ent.temp_id] = matchedExistingId;
        // Update existing entity with any new properties or date information
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
          await db.updateEntity(supabase, matchedExistingId, updates);
        }
      } else {
        const { getEmbedding } = await import('@/lib/embeddings');
        const embedding = await getEmbedding(`${ent.name} (${ent.type}): ${ent.summary || ''} ${JSON.stringify(ent.props || {})}`);

        const newEnt = await db.createEntity(supabase, {
          user_id: user.id,
          type: ent.type,
          name: ent.name,
          aliases: ent.aliases || [],
          summary: ent.summary || null,
          props: ent.props || {},
          created_from_entry: entry_id,
          embedding
        } as any);
        
        if (newEnt) {
          entityIdMap[ent.temp_id] = newEnt.id;
          createdEntities.push(newEnt.id);
          activeEntities.push(newEnt);
        }
      }
    }

    // 2. Process edges with bi-temporal versioning & Anti-Bypass Guard
    const { isDomainHubName } = await import('@/lib/graph-hierarchy');

    // Build set of entities that already have parents or incoming relations from other entities
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

    for (const edge of edges || []) {
      const srcId = entityIdMap[edge.src_temp_id];
      const dstId = entityIdMap[edge.dst_temp_id];
      if (!srcId || !dstId || srcId === dstId) continue;

      const isDirectMeEdge = srcId === meEntity.id || dstId === meEntity.id;
      if (isDirectMeEdge) {
        const otherId = srcId === meEntity.id ? dstId : srcId;
        const otherEntity = activeEntities.find(e => e.id === otherId);

        // If the other entity is nested or not a permitted root anchor, PRUNE direct edge and save fact!
        if (otherEntity && (entitiesWithParents.has(otherId) || !isPermittedRootAnchor(otherEntity))) {
          if (edge.relation && !['explores', 'passionate_about', 'aiming_for', 'has_preference', 'enjoys', 'trains', 'works_in', 'manages', 'travels_to', 'reflected_on'].includes(edge.relation)) {
            await db.createFact(supabase, {
              user_id: user.id,
              entity_id: otherId,
              key: 'status',
              value: edge.relation,
              entry_id: entry_id
            });
          }
          // Reject bypass spoke to root user!
          continue;
        }
      }

      await db.createEdge(supabase, {
        user_id: user.id,
        src: srcId,
        dst: dstId,
        relation: edge.relation,
        props: edge.props || {},
        entry_id: entry_id,
        occurred_on: event_date || null,
        valid_from: event_date || null,
        learned_at: new Date().toISOString()
      } as any);
    }

    // 3. Process facts
    for (const fact of facts || []) {
      const entityId = entityIdMap[fact.entity_temp_id];
      if (entityId) {
        await db.createFact(supabase, {
          user_id: user.id,
          entity_id: entityId,
          key: fact.key,
          value: fact.value,
          entry_id: entry_id
        });
      }
    }

    // 4. Link entry_entities
    const uniqueEntityIds = Array.from(new Set(Object.values(entityIdMap).filter(Boolean)));
    for (const realId of uniqueEntityIds) {
      await db.linkEntryEntity(supabase, {
        entry_id: entry_id,
        entity_id: realId
      }).catch(e => console.log('Already linked:', e.message));
    }

    // Link events to Me if event_date provided
    if (event_date && !uniqueEntityIds.includes(meEntity.id)) {
      await db.linkEntryEntity(supabase, {
        entry_id: entry_id,
        entity_id: meEntity.id
      }).catch(e => console.log('Already linked to Me', e.message));
    }

    // 5. Update entry status
    await db.updateEntry(supabase, entry_id, {
      status: 'committed',
      event_date: event_date || null
    });

    // 6. Update graph layout for new entities
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
        console.error('Layout update failed for', newId, e);
      }
    }

    // 7. Update cognitive clusters / living themes in background
    after(async () => {
      const { updateCognitiveClusters } = await import('@/lib/community-clustering');
      await updateCognitiveClusters(supabase, user.id).catch(e => console.warn('Cluster update err:', e));
    });

    // 8. Autonomous Subconscious Synthesis (Life Vectors & Cognitive Tensions)
    after(async () => {
      const { runSubconsciousSynthesis } = await import('@/lib/subconscious-engine');
      await runSubconsciousSynthesis(supabase, user.id).catch(e => console.warn('Subconscious synthesis err:', e));
    });

    return NextResponse.json({ success: true, createdEntities });
  } catch (error: any) {
    console.error('Commit error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
