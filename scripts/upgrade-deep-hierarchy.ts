import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function upgradeDeepHierarchy() {
  console.log('🚀 Upgrading knowledge graph to Deep Multi-Tier Ontology (Arbitrary Depth N >= 3)...');

  // 1. Fetch root user
  const { data: users } = await supabase.from('entities').select('*').contains('props', { is_user: true });
  if (!users || users.length === 0) return console.error('No root user found');
  const me = users[0];
  const userId = me.user_id;

  // 2. Fetch all active entities & edges
  const { data: entities } = await supabase.from('entities').select('*').eq('user_id', userId).is('deleted_at', null);
  const { data: edges } = await supabase.from('edges').select('*').eq('user_id', userId).is('deleted_at', null);
  if (!entities || !edges) return console.error('Failed to fetch graph data');

  const entityByName = new Map<string, any>();
  for (const ent of entities) {
    entityByName.set(ent.name.toLowerCase().trim(), ent);
  }

  const getOrCreateNode = async (name: string, type: string, summary: string, props: any = {}) => {
    const key = name.toLowerCase().trim();
    if (entityByName.has(key)) {
      const existing = entityByName.get(key);
      await supabase.from('entities').update({ props: { ...(existing.props || {}), ...props } }).eq('id', existing.id);
      return existing;
    }
    const { data: created, error } = await supabase.from('entities').insert({
      user_id: userId,
      name,
      type,
      aliases: [name.toLowerCase()],
      summary,
      props
    }).select().single();
    if (error) throw error;
    console.log(`✨ Created node: "${name}" (${created.id})`);
    entityByName.set(key, created);
    return created;
  };

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
      if (!error) console.log(`  + Edge: [${relation}] (${srcId} -> ${dstId})`);
    }
  };

  const deleteEdge = async (srcId: string, dstId: string) => {
    const matching = edges.filter(e => (e.src === srcId && e.dst === dstId) || (e.src === dstId && e.dst === srcId));
    for (const m of matching) {
      await supabase.from('edges').delete().eq('id', m.id);
      console.log(`  - Deleted edge: ${m.relation}`);
    }
  };

  // -------------------------------------------------------------
  // 1. Photography Deep Hierarchy:
  // Dheeraj Srinivasa -> Photography -> Camera Equipment -> Nikon Z50 -> Lenses
  //                                  -> Lighting Equipment -> Godox LC500R, SK400
  //                                  -> Creative Projects -> Short-film
  // -------------------------------------------------------------
  console.log('\n📸 Building Photography Multi-Tier Taxonomy...');
  // Ensure "Photography" domain hub
  let photoDomain = entityByName.get('photography');
  if (!photoDomain) {
    const oldPhoto = entityByName.get('photography & filmmaking');
    if (oldPhoto) {
      await supabase.from('entities').update({ name: 'Photography', aliases: ['photography & filmmaking', 'photography'] }).eq('id', oldPhoto.id);
      oldPhoto.name = 'Photography';
      photoDomain = oldPhoto;
      entityByName.set('photography', oldPhoto);
    } else {
      photoDomain = await getOrCreateNode('Photography', 'other', 'Photography domain hub', { is_domain_hub: true, level: 1 });
    }
  }

  await ensureEdge(me.id, photoDomain.id, 'passionate_about');

  const cameraEquipCat = await getOrCreateNode('Camera Equipment', 'other', 'Cameras, bodies, and optics', { is_category: true, level: 2 });
  const lightingEquipCat = await getOrCreateNode('Lighting Equipment', 'other', 'Studio strobes, continuous LED lights, and modifiers', { is_category: true, level: 2 });
  const creativeProjCat = await getOrCreateNode('Creative Projects', 'other', 'Short films, productions, and shoots', { is_category: true, level: 2 });

  await ensureEdge(photoDomain.id, cameraEquipCat.id, 'category');
  await ensureEdge(photoDomain.id, lightingEquipCat.id, 'category');
  await ensureEdge(photoDomain.id, creativeProjCat.id, 'category');

  const nikonZ50 = entityByName.get('nikon z50');
  if (nikonZ50) {
    // Delete old direct link from photoDomain to nikon
    await deleteEdge(photoDomain.id, nikonZ50.id);
    await deleteEdge(me.id, nikonZ50.id);
    await ensureEdge(cameraEquipCat.id, nikonZ50.id, 'camera_body');

    // Lenses connect to Nikon Z50
    const lenses = ['16-50mm kit lens', '35mm lens', '24mm lens', '56mm f/1.4 lens'];
    for (const lName of lenses) {
      const lEnt = entityByName.get(lName);
      if (lEnt) {
        await deleteEdge(me.id, lEnt.id);
        await deleteEdge(photoDomain.id, lEnt.id);
        await deleteEdge(cameraEquipCat.id, lEnt.id);
        await ensureEdge(nikonZ50.id, lEnt.id, 'has_lens');
      }
    }
  }

  const lights = ['godox lc500r', 'sk400 setup'];
  for (const lName of lights) {
    const lEnt = entityByName.get(lName);
    if (lEnt) {
      await deleteEdge(photoDomain.id, lEnt.id);
      await deleteEdge(me.id, lEnt.id);
      await ensureEdge(lightingEquipCat.id, lEnt.id, 'equipment');
    }
  }

  const shortFilm = entityByName.get('short-film project');
  if (shortFilm) {
    await deleteEdge(photoDomain.id, shortFilm.id);
    await deleteEdge(me.id, shortFilm.id);
    await ensureEdge(creativeProjCat.id, shortFilm.id, 'project');
  }

  // -------------------------------------------------------------
  // 2. Media & Entertainment Deep Hierarchy
  // Dheeraj Srinivasa -> Media & Entertainment -> Television & Series -> HIMYM
  //                                            -> Films & Cinema -> Catch Me If You Can
  //                                            -> Audiobooks & Podcasts -> Audible
  //                                            -> Gaming -> MCoC
  // -------------------------------------------------------------
  console.log('\n🎬 Building Media & Entertainment Multi-Tier Taxonomy...');
  const mediaDomain = await getOrCreateNode('Media & Entertainment', 'other', 'Movies, television series, books, and gaming', { is_domain_hub: true, level: 1 });
  await ensureEdge(me.id, mediaDomain.id, 'enjoys');

  const tvCat = await getOrCreateNode('Television & Series', 'other', 'TV shows, series, and sitcoms', { is_category: true, level: 2 });
  const filmCat = await getOrCreateNode('Films & Cinema', 'other', 'Feature films and movies', { is_category: true, level: 2 });
  const audioCat = await getOrCreateNode('Audiobooks & Literature', 'other', 'Audiobooks, reading, and literature', { is_category: true, level: 2 });
  const gamingCat = await getOrCreateNode('Gaming', 'other', 'Video games and mobile gaming', { is_category: true, level: 2 });

  await ensureEdge(mediaDomain.id, tvCat.id, 'category');
  await ensureEdge(mediaDomain.id, filmCat.id, 'category');
  await ensureEdge(mediaDomain.id, audioCat.id, 'category');
  await ensureEdge(mediaDomain.id, gamingCat.id, 'category');

  const catchMe = entityByName.get('catch me if you can');
  if (catchMe) {
    await deleteEdge(me.id, catchMe.id);
    await ensureEdge(filmCat.id, catchMe.id, 'movie');
  }

  const audible = entityByName.get('audible');
  if (audible) {
    await deleteEdge(me.id, audible.id);
    await ensureEdge(audioCat.id, audible.id, 'platform');
  }

  const mcoc = entityByName.get('marvel contest of champions');
  if (mcoc) {
    await deleteEdge(me.id, mcoc.id);
    await ensureEdge(gamingCat.id, mcoc.id, 'game');
  }

  // -------------------------------------------------------------
  // 3. International Relocation Deep Hierarchy:
  // Dheeraj Srinivasa -> International Relocation -> Target Countries -> US, Canada, etc.
  // -------------------------------------------------------------
  console.log('\n🌍 Building Relocation Multi-Tier Taxonomy...');
  const relocDomain = entityByName.get('international relocation') || 
    await getOrCreateNode('International Relocation', 'other', 'Target countries and global mobility', { is_domain_hub: true, level: 1 });
  await ensureEdge(me.id, relocDomain.id, 'aiming_for');

  const targetCountriesCat = await getOrCreateNode('Target Countries', 'other', 'Destination countries for relocation and career expansion', { is_category: true, level: 2 });
  await ensureEdge(relocDomain.id, targetCountriesCat.id, 'category');

  const countries = ['united states', 'canada', 'australia', 'united kingdom', 'singapore'];
  for (const cName of countries) {
    const cEnt = entityByName.get(cName);
    if (cEnt) {
      await deleteEdge(relocDomain.id, cEnt.id);
      await deleteEdge(me.id, cEnt.id);
      await ensureEdge(targetCountriesCat.id, cEnt.id, 'target_country');
    }
  }

  // -------------------------------------------------------------
  // 4. Dating & Relationships Deep Hierarchy:
  // Dheeraj Srinivasa -> Dating & Relationships -> Dating Platforms -> Tinder, Bumble...
  //                                             -> Personal Connections -> Cindy
  // -------------------------------------------------------------
  console.log('\n❤️ Building Dating & Relationships Multi-Tier Taxonomy...');
  const datingDomain = entityByName.get('dating & relationships') || 
    await getOrCreateNode('Dating & Relationships', 'other', 'Dating, social life, and connections', { is_domain_hub: true, level: 1 });
  await ensureEdge(me.id, datingDomain.id, 'explores');

  const datingAppsCat = await getOrCreateNode('Dating Platforms', 'other', 'Dating apps and matrimonial discovery', { is_category: true, level: 2 });
  const connectionsCat = await getOrCreateNode('Personal Connections', 'other', 'Romantic interests and social dates', { is_category: true, level: 2 });

  await ensureEdge(datingDomain.id, datingAppsCat.id, 'category');
  await ensureEdge(datingDomain.id, connectionsCat.id, 'category');

  const apps = ['tinder', 'bumble', 'hinge', 'aisle'];
  for (const aName of apps) {
    const aEnt = entityByName.get(aName);
    if (aEnt) {
      await deleteEdge(datingDomain.id, aEnt.id);
      await deleteEdge(me.id, aEnt.id);
      await ensureEdge(datingAppsCat.id, aEnt.id, 'platform');
    }
  }

  const cindy = entityByName.get('cindy');
  if (cindy) {
    await deleteEdge(datingDomain.id, cindy.id);
    await deleteEdge(me.id, cindy.id);
    await ensureEdge(connectionsCat.id, cindy.id, 'connection');
  }

  // -------------------------------------------------------------
  // 5. Food & Dietary Preferences Deep Hierarchy:
  // Dheeraj Srinivasa -> Food Preferences -> Favorite Dishes -> Dosa, Idli...
  //                                       -> Avoided Foods -> Bitter gourd...
  // -------------------------------------------------------------
  console.log('\n🍲 Building Food Preferences Multi-Tier Taxonomy...');
  const foodDomain = entityByName.get('food preferences') || 
    await getOrCreateNode('Food Preferences', 'other', 'Dietary habits and South Indian food preferences', { is_domain_hub: true, level: 1 });
  await ensureEdge(me.id, foodDomain.id, 'has_preference');

  const favDishesCat = await getOrCreateNode('Favorite Dishes', 'other', 'Beloved comfort foods and staple South Indian dishes', { is_category: true, level: 2 });
  const avoidFoodsCat = await getOrCreateNode('Avoided Foods', 'other', 'Disliked vegetables and avoided ingredients', { is_category: true, level: 2 });

  await ensureEdge(foodDomain.id, favDishesCat.id, 'category');
  await ensureEdge(foodDomain.id, avoidFoodsCat.id, 'category');

  const favorites = ['dosa', 'idli', 'peanut chutney'];
  for (const fName of favorites) {
    const fEnt = entityByName.get(fName);
    if (fEnt) {
      await deleteEdge(foodDomain.id, fEnt.id);
      await deleteEdge(me.id, fEnt.id);
      await ensureEdge(favDishesCat.id, fEnt.id, 'favorite_dish');
    }
  }

  const avoids = ['leafy greens', 'bitter gourd', 'brinjal', 'tomato'];
  for (const aName of avoids) {
    const aEnt = entityByName.get(aName);
    if (aEnt) {
      await deleteEdge(foodDomain.id, aEnt.id);
      await deleteEdge(me.id, aEnt.id);
      await ensureEdge(avoidFoodsCat.id, aEnt.id, 'avoids');
    }
  }

  console.log('\n🎉 Multi-tier deep hierarchy upgrade successfully completed!');
}

upgradeDeepHierarchy().catch(console.error);
