import { NextResponse } from 'next/server';
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
          await db.updateEntity(supabase, meEntity.id, updates);
        }
        continue;
      }

      if (ent.match?.existing_id && ent.match.confidence > 0.8) {
        entityIdMap[ent.temp_id] = ent.match.existing_id;
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
        }
      }
    }

    // 2. Process edges with bi-temporal versioning
    for (const edge of edges || []) {
      const srcId = entityIdMap[edge.src_temp_id];
      const dstId = entityIdMap[edge.dst_temp_id];
      if (srcId && dstId && srcId !== dstId) {
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
    import('@/lib/community-clustering').then(({ updateCognitiveClusters }) => {
      updateCognitiveClusters(supabase, user.id).catch(e => console.warn('Cluster update err:', e));
    });

    return NextResponse.json({ success: true, createdEntities });
  } catch (error: any) {
    console.error('Commit error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
