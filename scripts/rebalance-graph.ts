import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function rebalanceGraph() {
  console.log('🔄 Rebalancing graph from flat star-burst to structured domain lobes...');

  // 1. Fetch root user
  const { data: users, error: uErr } = await supabase.from('entities').select('*').contains('props', { is_user: true });
  if (uErr || !users || users.length === 0) {
    console.error('Failed to find root user entity:', uErr);
    return;
  }
  const me = users[0];
  const userId = me.user_id;
  console.log(`Found root user: "${me.name}" (${me.id}), user_id: ${userId}`);

  // 2. Fetch all entities and edges
  const { data: entities, error: entErr } = await supabase.from('entities').select('*').eq('user_id', userId).is('deleted_at', null);
  if (entErr || !entities) {
    console.error('Failed to fetch entities:', entErr);
    return;
  }
  const { data: edges, error: edgErr } = await supabase.from('edges').select('*').eq('user_id', userId).is('deleted_at', null);
  if (edgErr || !edges) {
    console.error('Failed to fetch edges:', edgErr);
    return;
  }

  console.log(`Current entities: ${entities.length}, Current edges: ${edges.length}`);

  const entityByName = new Map<string, any>();
  for (const ent of entities) {
    entityByName.set(ent.name.toLowerCase().trim(), ent);
  }

  // Helper to ensure an entity exists
  const getOrCreateEntity = async (name: string, type: string, summary: string) => {
    const key = name.toLowerCase().trim();
    if (entityByName.has(key)) {
      return entityByName.get(key);
    }
    const { data: created, error } = await supabase.from('entities').insert({
      user_id: userId,
      name,
      type,
      aliases: [name.toLowerCase()],
      summary,
      props: { is_domain_hub: true }
    }).select().single();

    if (error) {
      console.error(`Failed to create ${name}:`, error);
      throw error;
    }
    console.log(`✨ Created domain hub entity: "${name}" (${created.id})`);
    entityByName.set(key, created);
    return created;
  };

  // Helper to create edge
  const ensureEdge = async (srcId: string, dstId: string, relation: string, props: any = {}) => {
    const exists = edges.some(e => e.src === srcId && e.dst === dstId && e.relation === relation);
    if (!exists) {
      const { error } = await supabase.from('edges').insert({
        user_id: userId,
        src: srcId,
        dst: dstId,
        relation,
        props,
        learned_at: new Date().toISOString()
      });
      if (error) console.error(`Error adding edge ${relation}:`, error);
      else console.log(`  + Edge: [${relation}] -> ${dstId}`);
    }
  };

  // Helper to delete edge
  const deleteEdge = async (srcId: string, dstId: string) => {
    const matching = edges.filter(e => (e.src === srcId && e.dst === dstId) || (e.src === dstId && e.dst === srcId));
    for (const m of matching) {
      const { error } = await supabase.from('edges').delete().eq('id', m.id);
      if (error) console.error(`Error deleting edge ${m.id}:`, error);
      else console.log(`  - Removed flat edge: ${m.relation} (${m.src} -> ${m.dst})`);
    }
  };

  // =========================================================================
  // 1. Photography & Filmmaking Hub
  // =========================================================================
  console.log('\n📸 Structuring Photography & Creative Equipment Subgraph...');
  const photoHub = await getOrCreateEntity(
    'Photography & Filmmaking',
    'other',
    'Photography, creative filmmaking, and studio equipment constellation'
  );
  await ensureEdge(me.id, photoHub.id, 'passionate_about');

  const nikonZ50 = entityByName.get('nikon z50');
  if (nikonZ50) {
    await ensureEdge(photoHub.id, nikonZ50.id, 'primary_camera');
  }

  const lenses = ['16-50mm kit lens', '35mm lens', '24mm lens', '56mm f/1.4 lens'];
  for (const lensName of lenses) {
    const lensEnt = entityByName.get(lensName.toLowerCase());
    if (lensEnt) {
      await deleteEdge(me.id, lensEnt.id);
      if (nikonZ50) {
        await ensureEdge(nikonZ50.id, lensEnt.id, 'has_lens');
      } else {
        await ensureEdge(photoHub.id, lensEnt.id, 'equipment');
      }
    }
  }

  const lights = ['godox lc500r', 'sk400 setup'];
  for (const lightName of lights) {
    const lightEnt = entityByName.get(lightName.toLowerCase());
    if (lightEnt) {
      await deleteEdge(me.id, lightEnt.id);
      await ensureEdge(photoHub.id, lightEnt.id, 'lighting_gear');
    }
  }

  const shortFilm = entityByName.get('short-film project');
  if (shortFilm) {
    await deleteEdge(me.id, shortFilm.id);
    await ensureEdge(photoHub.id, shortFilm.id, 'creative_project');
  }

  // =========================================================================
  // 2. Dating & Relationships Hub
  // =========================================================================
  console.log('\n❤️ Structuring Dating & Relationships Subgraph...');
  const datingHub = await getOrCreateEntity(
    'Dating & Relationships',
    'other',
    'Dating platforms, connections, and relationship exploration'
  );
  await ensureEdge(me.id, datingHub.id, 'explores');

  const datingApps = ['tinder', 'bumble', 'hinge', 'aisle'];
  for (const appName of datingApps) {
    const appEnt = entityByName.get(appName.toLowerCase());
    if (appEnt) {
      await deleteEdge(me.id, appEnt.id);
      await ensureEdge(datingHub.id, appEnt.id, 'platform');
    }
  }

  const cindy = entityByName.get('cindy');
  if (cindy) {
    await deleteEdge(me.id, cindy.id);
    await ensureEdge(datingHub.id, cindy.id, 'connection');
  }

  // =========================================================================
  // 3. International Relocation Hub
  // =========================================================================
  console.log('\n🌍 Structuring International Relocation Subgraph...');
  const relocHub = await getOrCreateEntity(
    'International Relocation',
    'other',
    'Target countries and global mobility opportunities'
  );
  await ensureEdge(me.id, relocHub.id, 'aiming_for');

  const countries = ['united states', 'canada', 'australia', 'united kingdom', 'singapore'];
  for (const cName of countries) {
    const cEnt = entityByName.get(cName.toLowerCase());
    if (cEnt) {
      await deleteEdge(me.id, cEnt.id);
      await ensureEdge(relocHub.id, cEnt.id, 'target_country');
    }
  }

  // =========================================================================
  // 4. Food & Dietary Preferences Hub
  // =========================================================================
  console.log('\n🍲 Structuring Food & Dietary Preferences Subgraph...');
  const foodHub = await getOrCreateEntity(
    'Food Preferences',
    'other',
    'South Indian cuisine favorites, daily staples, and avoided foods'
  );
  await ensureEdge(me.id, foodHub.id, 'has_preference');

  const favorites = ['dosa', 'idli', 'peanut chutney'];
  for (const fName of favorites) {
    const fEnt = entityByName.get(fName.toLowerCase());
    if (fEnt) {
      await deleteEdge(me.id, fEnt.id);
      await ensureEdge(foodHub.id, fEnt.id, 'favorite_dish');
    }
  }

  const avoids = ['leafy greens', 'bitter gourd', 'brinjal', 'tomato'];
  for (const aName of avoids) {
    const aEnt = entityByName.get(aName.toLowerCase());
    if (aEnt) {
      await deleteEdge(me.id, aEnt.id);
      await ensureEdge(foodHub.id, aEnt.id, 'avoids');
    }
  }

  // =========================================================================
  // 5. Geographic Hierarchy (Karnataka)
  // =========================================================================
  console.log('\n🗺️ Structuring Geographic Subgraph...');
  const karnataka = entityByName.get('karnataka');
  const bangalore = entityByName.get('bangalore');
  const mysore = entityByName.get('mysore');

  if (karnataka && bangalore) {
    await ensureEdge(karnataka.id, bangalore.id, 'contains_city');
  }
  if (karnataka && mysore) {
    await ensureEdge(karnataka.id, mysore.id, 'contains_city');
    await deleteEdge(me.id, mysore.id);
  }

  console.log('\n✅ Graph rebalancing complete! Verifying new topology...');
}

rebalanceGraph().catch(console.error);
