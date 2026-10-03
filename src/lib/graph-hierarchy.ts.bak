/**
 * Multi-Tier Graph Hierarchy & Universal Anti-Bypass Engine
 * 
 * Guarantees pure hierarchical tree/DAG topology with arbitrary depth N >= 3:
 * Level 0: Root User (Me)
 *  └── Level 1: Domain Hubs (Photography, Media & Entertainment, Health & Fitness, Dating & Relationships...)
 *       └── Level 2: Category Nodes (Camera Equipment, Television & Series, Strength Training, Dating Platforms...)
 *            └── Level 3: Hardware / Series / Entities (Nikon Z50, HIMYM, Nymph, Bench Press...)
 *                 └── Level 4: Components / Lenses (Viltrox 35mm f/1.8...)
 * 
 * UNIVERSAL INVARIANTS:
 * 1. STRICT ZERO DANDELION / STAR SPOKES:
 *    Any entity nested under a category or intermediate parent is STRICTLY FORBIDDEN
 *    from having a direct edge to/from Root User (Me).
 *    User actions ("trying", "watched", "bought", "likes", "ate") are recorded as facts on the entity.
 * 2. NO DISCONNECTED ISLANDS:
 *    Every entity belongs to a domain/category tree rooted at 'Me'.
 * 3. SINGLE CANONICAL DOWNWARD DIRECTION:
 *    Hierarchical links strictly flow downward (Domain -> Category -> Entity -> Subcomponent).
 *    Reverse/cyclic edges (e.g. child -> parent) are collapsed into canonical downward edges.
 */

export interface RawEntity {
  temp_id: string;
  type: string;
  name: string;
  aliases?: string[];
  summary?: string | null;
  props?: Record<string, any>;
  match?: {
    existing_id: string | null;
    confidence: number;
    candidate_names?: string[];
  } | null;
}

export interface RawEdge {
  src_temp_id: string;
  dst_temp_id: string;
  relation: string;
  props?: Record<string, any>;
}

export interface RawFact {
  entity_temp_id: string;
  key: string;
  value: string;
}

export interface ExistingCandidate {
  id: string;
  name: string;
  type: string;
  aliases?: string[];
  summary?: string | null;
  props?: Record<string, any>;
}

// Canonical Domain Hub Definitions with recognized aliases
export const DOMAIN_HUB_DEFINITIONS = [
  {
    name: 'Photography',
    aliases: ['photography', 'photography & filmmaking', 'filmmaking', 'camera & optics', 'photo', 'optics'],
    summary: 'Photography, camera equipment, lighting setups, and filmmaking projects',
    defaultRelation: 'passionate_about'
  },
  {
    name: 'Media & Entertainment',
    aliases: ['media & entertainment', 'media', 'entertainment', 'movies & shows', 'cinema', 'pop culture', 'gaming', 'audiobooks & literature', 'books', 'shows'],
    summary: 'Movies, television series, literature, audiobooks, and gaming',
    defaultRelation: 'enjoys'
  },
  {
    name: 'Health & Fitness',
    aliases: ['health & fitness', 'fitness', 'gym & fitness', 'workouts', 'body & fitness', 'exercise', 'training', 'athletics', 'lifting', 'health'],
    summary: 'Strength workouts, gym routines, physique development, and health metrics',
    defaultRelation: 'trains'
  },
  {
    name: 'Dating & Relationships',
    aliases: ['dating & relationships', 'dating', 'relationships', 'romance', 'matrimonial', 'dating platforms', 'personal connections'],
    summary: 'Dating platforms, romantic interests, social connections, and relationship goals',
    defaultRelation: 'explores'
  },
  {
    name: 'Career & Professional',
    aliases: ['career & professional', 'career', 'work', 'job', 'software engineering', 'professional', 'engineering', 'tech stack', 'computing'],
    summary: 'Professional career, employer, tech stack, software engineering, and skills',
    defaultRelation: 'works_in'
  },
  {
    name: 'Finance & Wealth',
    aliases: ['finance & wealth', 'finances', 'finance', 'wealth', 'money', 'investments', 'budget', 'portfolio', 'stocks', 'crypto', 'savings'],
    summary: 'Investments, mutual funds, personal budget, wealth targets, and debt management',
    defaultRelation: 'manages'
  },
  {
    name: 'Travel & Places',
    aliases: ['travel & places', 'travel', 'trips', 'places', 'geography', 'vacations', 'cities', 'destinations'],
    summary: 'Travel journeys, destinations, vacations, and geographic locations',
    defaultRelation: 'travels_to'
  },
  {
    name: 'Food Preferences',
    aliases: ['food preferences', 'food', 'diet', 'cuisine', 'meals', 'nutrition', 'dishes', 'comfort foods'],
    summary: 'South Indian cuisine staples, favorite dishes, and avoided foods',
    defaultRelation: 'has_preference'
  },
  {
    name: 'International Relocation',
    aliases: ['international relocation', 'relocation', 'immigration', 'moving abroad', 'target countries'],
    summary: 'Target countries and global mobility opportunities for career expansion',
    defaultRelation: 'aiming_for'
  },
  {
    name: 'Mind & Philosophy',
    aliases: ['mind & philosophy', 'mindset', 'philosophy', 'self-reflection', 'personal growth', 'psychology'],
    summary: 'Life philosophy, mindset, personal reflections, and identity reset',
    defaultRelation: 'reflected_on'
  }
];

export const DOMAIN_HUBS = DOMAIN_HUB_DEFINITIONS.map(d => d.name);

// Canonical Categories across all Domains
export const CATEGORY_NAMES = [
  // Photography
  'Camera Equipment',
  'Lighting Equipment',
  'Creative Projects',
  // Media
  'Television & Series',
  'Films & Cinema',
  'Audiobooks & Literature',
  'Gaming',
  'Podcasts & Audio',
  // Dating
  'Dating Platforms',
  'Personal Connections',
  // Fitness
  'Strength Training',
  'Gyms & Facilities',
  'Fitness Tracking',
  'Sports & Athletics',
  // Career & Tech
  'Tech Stack & Skills',
  'Computing Hardware',
  'Colleagues & Network',
  'Productivity Tools',
  // Finance
  'Investments & Assets',
  'Debt & Loans',
  'Budget & Spending',
  // Travel
  'Destinations & Cities',
  'Trips & Vacations',
  // Food
  'Favorite Dishes',
  'Avoided Foods',
  'Restaurants & Cafes',
  // Relocation
  'Target Countries',
  // Mind
  'Self-Reflection & Goals'
];

export function isDomainHubName(name: string): boolean {
  const norm = name.toLowerCase().trim();
  return DOMAIN_HUB_DEFINITIONS.some(
    d => d.name.toLowerCase() === norm || d.aliases.some(a => a.toLowerCase() === norm)
  );
}

export function isCategoryName(name: string): boolean {
  const norm = name.toLowerCase().trim();
  return CATEGORY_NAMES.some(c => c.toLowerCase() === norm);
}

export function getCanonicalDomainHub(name: string): typeof DOMAIN_HUB_DEFINITIONS[0] | undefined {
  const norm = name.toLowerCase().trim();
  return DOMAIN_HUB_DEFINITIONS.find(
    d => d.name.toLowerCase() === norm || d.aliases.some(a => a.toLowerCase() === norm)
  );
}

// Comprehensive Semantic Regexes
const LENS_REGEX = /\b(lens|kit lens|prime|zoom|nikkor|sigma|viltrox|tamron|\d+mm|f\/\d+(\.\d+)?)\b/i;
const CAMERA_REGEX = /\b(nikon|canon|sony|fujifilm|lumix|camera|body|z50|z6|z7|z8|z9|a7|a6\d{3}|dslr|mirrorless)\b/i;
const LIGHTING_REGEX = /\b(godox|lc500|sk400|light|lights|softbox|strobe|speedlight|flash|aputure|nanlite|reflector|tripod|diffuser|led panel)\b/i;
const CREATIVE_PROJECT_REGEX = /\b(short-film|short film|shortfilm|film project|documentary|photo shoot|photoshoot)\b/i;

const DATING_APP_REGEX = /\b(tinder|bumble|hinge|aisle|okcupid|match\.com|grindr|jeevansathi|shaadi|coffeemeetsbagel|nymph|feeld|pure|raya|badoo)\b/i;
const TARGET_COUNTRY_REGEX = /\b(united states|usa|canada|australia|united kingdom|uk|singapore|germany|netherlands|ireland|new zealand|dubai|switzerland)\b/i;
const FOOD_DISLIKES_REGEX = /\b(leafy greens|bitter gourd|brinjal|eggplant|tomato|okra|capsicum)\b/i;
const FOOD_LIKES_REGEX = /\b(dosa|idli|peanut chutney|chutney|vada|sambar|biryani|pulao|roti|paneer)\b/i;

const TV_SHOW_REGEX = /\b(how i met your mother|himym|breaking bad|game of thrones|got|better call saul|friends|office|the office|sitcom|series|episode|season)\b/i;
const MOVIE_REGEX = /\b(catch me if you can|inception|interstellar|movie|film|cinema)\b/i;
const GAME_REGEX = /\b(contest of champions|mcoc|game|gaming|steam|ps5|xbox|rpg|mmo)\b/i;

const FITNESS_EXERCISE_REGEX = /\b(bench press|squat|squats|deadlift|bicep curl|curls|push-up|push-ups|pull-up|pull-ups|dumbbell|barbell|kettlebell|cindy|cardio|running|workout)\b/i;
const FITNESS_GYM_REGEX = /\b(cult|cult\.fit|cult gym|gold's gym|gym|fitness center)\b/i;

const TECH_HARDWARE_REGEX = /\b(keyboard|keychron|mouse|logitech|monitor|macbook|laptop|headphones|anc|bose|sony wh|airpods)\b/i;
const FINANCE_ASSET_REGEX = /\b(mutual fund|etf|reit|bond|stocks|nifty|zerodha|groww|demat|sip|investing|investment|emi|loan|debt)\b/i;

export function restructureHierarchicalExtraction(
  entities: RawEntity[],
  edges: RawEdge[],
  facts: RawFact[],
  candidates: ExistingCandidate[] = []
): { entities: RawEntity[]; edges: RawEdge[]; facts: RawFact[] } {
  const newEntities: RawEntity[] = [...entities];
  let newEdges: RawEdge[] = [...edges];

  // Map to normalize entity lookup by temp_id, candidate id, and lowercased name
  const canonicalIdMap = new Map<string, string>();
  for (const ent of newEntities) {
    canonicalIdMap.set(ent.temp_id, ent.temp_id);
    if (ent.match?.existing_id) {
      canonicalIdMap.set(ent.match.existing_id, ent.temp_id);
    }
  }

  // Canonicalize any domain hub names already in entities (e.g. "Gym & Fitness" -> "Health & Fitness")
  for (const ent of newEntities) {
    if (ent.temp_id === 'me') continue;
    const domHub = getCanonicalDomainHub(ent.name);
    if (domHub && ent.name !== domHub.name) {
      ent.aliases = Array.from(new Set([...(ent.aliases || []), ent.name]));
      ent.name = domHub.name;
      ent.props = { ...(ent.props || {}), is_domain_hub: true, level: 1 };
    }
  }

  // Helper to find or create an entity (checking candidates first)
  const getOrCreateNode = (
    tempId: string,
    name: string,
    type: any,
    summary: string,
    props: Record<string, any> = {}
  ): RawEntity => {
    let existing = newEntities.find(
      e => e.temp_id === tempId || e.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      existing.props = { ...(existing.props || {}), ...props };
      canonicalIdMap.set(tempId, existing.temp_id);
      return existing;
    }

    const dbCandidate = candidates.find(
      c => c.name.toLowerCase() === name.toLowerCase() || (c.aliases || []).some(a => a.toLowerCase() === name.toLowerCase())
    );

    const created: RawEntity = {
      temp_id: tempId,
      name,
      type,
      aliases: [name.toLowerCase()],
      summary,
      props,
      match: dbCandidate ? { existing_id: dbCandidate.id, confidence: 1.0 } : null
    };

    newEntities.push(created);
    canonicalIdMap.set(tempId, created.temp_id);
    if (dbCandidate) {
      canonicalIdMap.set(dbCandidate.id, created.temp_id);
    }
    return created;
  };

  const removeDirectMeEdge = (targetTempId: string) => {
    newEdges = newEdges.filter(
      e => !(e.src_temp_id === 'me' && e.dst_temp_id === targetTempId) &&
           !(e.dst_temp_id === 'me' && e.src_temp_id === targetTempId)
    );
  };

  const addEdgeIfMissing = (
    src_temp_id: string,
    dst_temp_id: string,
    relation: string,
    props: Record<string, any> = {}
  ) => {
    const s = canonicalIdMap.get(src_temp_id) || src_temp_id;
    const d = canonicalIdMap.get(dst_temp_id) || dst_temp_id;
    if (s === d) return;

    const exists = newEdges.some(
      e => {
        const es = canonicalIdMap.get(e.src_temp_id) || e.src_temp_id;
        const ed = canonicalIdMap.get(e.dst_temp_id) || e.dst_temp_id;
        return (es === s && ed === d && e.relation === relation) || (es === d && ed === s);
      }
    );
    if (!exists) {
      newEdges.push({ src_temp_id: s, dst_temp_id: d, relation, props });
    }
  };

  // =========================================================================
  // 1. Photography Multi-Tier Hierarchy:
  // Me -> Photography -> Camera Equipment -> Nikon Z50 -> Lenses
  //                   -> Lighting Equipment -> Godox lights
  //                   -> Creative Projects -> Short film
  // =========================================================================
  const cameraEntities = newEntities.filter(
    e => CAMERA_REGEX.test(e.name) && !LENS_REGEX.test(e.name) && e.temp_id !== 'me'
  );
  const lensEntities = newEntities.filter(
    e => LENS_REGEX.test(e.name) && e.temp_id !== 'me'
  );
  const lightingEntities = newEntities.filter(
    e => LIGHTING_REGEX.test(e.name) && e.temp_id !== 'me'
  );
  const creativeEntities = newEntities.filter(
    e => CREATIVE_PROJECT_REGEX.test(e.name) && e.temp_id !== 'me'
  );

  if (cameraEntities.length > 0 || lensEntities.length > 0 || lightingEntities.length > 0 || creativeEntities.length > 0) {
    const photoHub = getOrCreateNode('hub_photography', 'Photography', 'other', 'Photography, camera equipment, lighting setups, and filmmaking projects', { is_domain_hub: true, level: 1 });
    addEdgeIfMissing('me', photoHub.temp_id, 'passionate_about');

    if (cameraEntities.length > 0 || lensEntities.length > 0) {
      const cameraCat = getOrCreateNode('cat_camera_equip', 'Camera Equipment', 'other', 'Cameras, bodies, optics, and accessories', { is_category: true, domain: 'Photography', level: 2 });
      addEdgeIfMissing(photoHub.temp_id, cameraCat.temp_id, 'category');

      let primaryCam = cameraEntities[0];
      if (!primaryCam) {
        const dbCam = candidates.find(c => CAMERA_REGEX.test(c.name) && !LENS_REGEX.test(c.name));
        if (dbCam) {
          primaryCam = getOrCreateNode(dbCam.id, dbCam.name, dbCam.type, dbCam.summary || '', dbCam.props || {});
        }
      }

      for (const cam of cameraEntities) {
        removeDirectMeEdge(cam.temp_id);
        addEdgeIfMissing(cameraCat.temp_id, cam.temp_id, 'camera_body');
      }

      for (const lens of lensEntities) {
        removeDirectMeEdge(lens.temp_id);
        if (primaryCam) {
          addEdgeIfMissing(primaryCam.temp_id, lens.temp_id, 'has_lens');
        } else {
          addEdgeIfMissing(cameraCat.temp_id, lens.temp_id, 'lens');
        }
      }
    }

    if (lightingEntities.length > 0) {
      const lightCat = getOrCreateNode('cat_lighting_equip', 'Lighting Equipment', 'other', 'Studio strobes, continuous LED lights, and modifiers', { is_category: true, domain: 'Photography', level: 2 });
      addEdgeIfMissing(photoHub.temp_id, lightCat.temp_id, 'category');

      for (const light of lightingEntities) {
        removeDirectMeEdge(light.temp_id);
        addEdgeIfMissing(lightCat.temp_id, light.temp_id, 'equipment');
      }
    }

    if (creativeEntities.length > 0) {
      const creativeCat = getOrCreateNode('cat_creative_proj', 'Creative Projects', 'other', 'Short films, video productions, and shoots', { is_category: true, domain: 'Photography', level: 2 });
      addEdgeIfMissing(photoHub.temp_id, creativeCat.temp_id, 'category');

      for (const proj of creativeEntities) {
        removeDirectMeEdge(proj.temp_id);
        addEdgeIfMissing(creativeCat.temp_id, proj.temp_id, 'project');
      }
    }
  }

  // =========================================================================
  // 2. Media & Entertainment Multi-Tier Hierarchy:
  // Me -> Media & Entertainment -> Television & Series -> HIMYM
  //                             -> Films & Cinema -> Movie
  //                             -> Gaming -> Game
  //                             -> Audiobooks & Literature -> Book/Platform
  // =========================================================================
  const showEntities = newEntities.filter(
    e => (e.type === 'show' || TV_SHOW_REGEX.test(e.name)) && e.temp_id !== 'me'
  );
  const movieEntities = newEntities.filter(
    e => (e.type === 'movie' || MOVIE_REGEX.test(e.name)) && e.temp_id !== 'me'
  );
  const audioEntities = newEntities.filter(
    e => (e.name.toLowerCase() === 'audible' || e.type === 'book') && e.temp_id !== 'me'
  );
  const gameEntities = newEntities.filter(
    e => (GAME_REGEX.test(e.name) || e.name.toLowerCase().includes('contest of champions') || e.name.toLowerCase() === 'mcoc') && e.temp_id !== 'me'
  );

  if (showEntities.length > 0 || movieEntities.length > 0 || audioEntities.length > 0 || gameEntities.length > 0) {
    const mediaHub = getOrCreateNode('hub_media', 'Media & Entertainment', 'other', 'Movies, television series, literature, audiobooks, and gaming', { is_domain_hub: true, level: 1 });
    addEdgeIfMissing('me', mediaHub.temp_id, 'enjoys');

    if (showEntities.length > 0) {
      const tvCat = getOrCreateNode('cat_tv_series', 'Television & Series', 'other', 'TV shows, sitcoms, and series', { is_category: true, domain: 'Media & Entertainment', level: 2 });
      addEdgeIfMissing(mediaHub.temp_id, tvCat.temp_id, 'category');
      for (const show of showEntities) {
        removeDirectMeEdge(show.temp_id);
        addEdgeIfMissing(tvCat.temp_id, show.temp_id, 'series');
      }
    }

    if (movieEntities.length > 0) {
      const filmCat = getOrCreateNode('cat_films_cinema', 'Films & Cinema', 'other', 'Feature films and cinema', { is_category: true, domain: 'Media & Entertainment', level: 2 });
      addEdgeIfMissing(mediaHub.temp_id, filmCat.temp_id, 'category');
      for (const movie of movieEntities) {
        removeDirectMeEdge(movie.temp_id);
        addEdgeIfMissing(filmCat.temp_id, movie.temp_id, 'movie');
      }
    }

    if (audioEntities.length > 0) {
      const audioCat = getOrCreateNode('cat_audio_lit', 'Audiobooks & Literature', 'other', 'Audiobooks, podcasts, and reading platforms', { is_category: true, domain: 'Media & Entertainment', level: 2 });
      addEdgeIfMissing(mediaHub.temp_id, audioCat.temp_id, 'category');
      for (const aud of audioEntities) {
        removeDirectMeEdge(aud.temp_id);
        addEdgeIfMissing(audioCat.temp_id, aud.temp_id, 'platform');
      }
    }

    if (gameEntities.length > 0) {
      const gamingCat = getOrCreateNode('cat_gaming', 'Gaming', 'other', 'Video games and mobile gaming', { is_category: true, domain: 'Media & Entertainment', level: 2 });
      addEdgeIfMissing(mediaHub.temp_id, gamingCat.temp_id, 'category');
      for (const game of gameEntities) {
        removeDirectMeEdge(game.temp_id);
        addEdgeIfMissing(gamingCat.temp_id, game.temp_id, 'game');
      }
    }
  }

  // =========================================================================
  // 3. Health & Fitness Multi-Tier Hierarchy:
  // Me -> Health & Fitness -> Strength Training -> Bench Press, Squats, Cindy
  //                        -> Gyms & Facilities -> Cult Gym
  // =========================================================================
  const exerciseEntities = newEntities.filter(
    e => (FITNESS_EXERCISE_REGEX.test(e.name) || e.name.toLowerCase() === 'cindy') && e.temp_id !== 'me'
  );
  const gymEntities = newEntities.filter(
    e => FITNESS_GYM_REGEX.test(e.name) && e.temp_id !== 'me'
  );

  if (exerciseEntities.length > 0 || gymEntities.length > 0) {
    const fitnessHub = getOrCreateNode('hub_fitness', 'Health & Fitness', 'other', 'Strength workouts, gym routines, physique development, and health metrics', { is_domain_hub: true, level: 1 });
    addEdgeIfMissing('me', fitnessHub.temp_id, 'trains');

    if (exerciseEntities.length > 0) {
      const strengthCat = getOrCreateNode('cat_strength_training', 'Strength Training', 'other', 'Barbell, dumbbell, calisthenics, and benchmark workouts', { is_category: true, domain: 'Health & Fitness', level: 2 });
      addEdgeIfMissing(fitnessHub.temp_id, strengthCat.temp_id, 'category');

      for (const ex of exerciseEntities) {
        removeDirectMeEdge(ex.temp_id);
        addEdgeIfMissing(strengthCat.temp_id, ex.temp_id, 'exercise');
      }
    }

    if (gymEntities.length > 0) {
      const gymCat = getOrCreateNode('cat_gyms_facilities', 'Gyms & Facilities', 'other', 'Gym memberships and fitness training facilities', { is_category: true, domain: 'Health & Fitness', level: 2 });
      addEdgeIfMissing(fitnessHub.temp_id, gymCat.temp_id, 'category');

      for (const gym of gymEntities) {
        removeDirectMeEdge(gym.temp_id);
        addEdgeIfMissing(gymCat.temp_id, gym.temp_id, 'facility');
      }
    }
  }

  // =========================================================================
  // 4. Dating & Relationships Multi-Tier Hierarchy:
  // Me -> Dating & Relationships -> Dating Platforms -> Nymph, Tinder, Bumble...
  //                              -> Personal Connections -> Cindy
  // =========================================================================
  const datingAppEntities = newEntities.filter(
    e => (DATING_APP_REGEX.test(e.name) || 
          e.props?.app_type?.includes('dating') || 
          e.summary?.toLowerCase().includes('dating') ||
          newEdges.some(ed => ed.dst_temp_id === e.temp_id && (ed.relation === 'platform' || ed.relation.includes('dating')))) &&
          e.temp_id !== 'me'
  );
  const prospectEntity = newEntities.find(
    e => e.name.toLowerCase() === 'cindy' && !e.props?.is_workout && e.temp_id !== 'me'
  );

  if (datingAppEntities.length > 0 || prospectEntity) {
    const datingHub = getOrCreateNode('hub_dating', 'Dating & Relationships', 'other', 'Dating platforms, romantic interests, and relationship exploration', { is_domain_hub: true, level: 1 });
    addEdgeIfMissing('me', datingHub.temp_id, 'explores');

    if (datingAppEntities.length > 0) {
      const datingPlatformsCat = getOrCreateNode('cat_dating_platforms', 'Dating Platforms', 'other', 'Dating apps and matrimonial discovery', { is_category: true, domain: 'Dating & Relationships', level: 2 });
      addEdgeIfMissing(datingHub.temp_id, datingPlatformsCat.temp_id, 'category');

      for (const app of datingAppEntities) {
        removeDirectMeEdge(app.temp_id);
        addEdgeIfMissing(datingPlatformsCat.temp_id, app.temp_id, 'platform');
      }
    }

    if (prospectEntity) {
      const connectionsCat = getOrCreateNode('cat_personal_connections', 'Personal Connections', 'other', 'Romantic interests and social dates', { is_category: true, domain: 'Dating & Relationships', level: 2 });
      addEdgeIfMissing(datingHub.temp_id, connectionsCat.temp_id, 'category');

      removeDirectMeEdge(prospectEntity.temp_id);
      addEdgeIfMissing(connectionsCat.temp_id, prospectEntity.temp_id, 'connection');
    }
  }

  // =========================================================================
  // 5. Tech & Workstations / Career Multi-Tier Hierarchy:
  // Me -> Career & Professional -> Computing Hardware -> Keychron K2, MacBook
  // =========================================================================
  const techHardwareEntities = newEntities.filter(
    e => TECH_HARDWARE_REGEX.test(e.name) && e.temp_id !== 'me'
  );

  if (techHardwareEntities.length > 0) {
    const careerHub = getOrCreateNode('hub_career', 'Career & Professional', 'other', 'Professional career, employer, tech stack, and workstations', { is_domain_hub: true, level: 1 });
    addEdgeIfMissing('me', careerHub.temp_id, 'works_in');

    const hardwareCat = getOrCreateNode('cat_computing_hw', 'Computing Hardware', 'other', 'Workstation peripherals, mechanical keyboards, laptops, and gadgets', { is_category: true, domain: 'Career & Professional', level: 2 });
    addEdgeIfMissing(careerHub.temp_id, hardwareCat.temp_id, 'category');

    for (const hw of techHardwareEntities) {
      removeDirectMeEdge(hw.temp_id);
      addEdgeIfMissing(hardwareCat.temp_id, hw.temp_id, 'hardware');
    }
  }

  // =========================================================================
  // 6. Finance & Wealth Multi-Tier Hierarchy:
  // Me -> Finance & Wealth -> Investments & Assets -> Mutual Funds, Stocks
  // =========================================================================
  const financeEntities = newEntities.filter(
    e => FINANCE_ASSET_REGEX.test(e.name) && e.temp_id !== 'me'
  );

  if (financeEntities.length > 0) {
    const finHub = getOrCreateNode('hub_finance', 'Finance & Wealth', 'other', 'Investments, mutual funds, personal budget, and wealth targets', { is_domain_hub: true, level: 1 });
    addEdgeIfMissing('me', finHub.temp_id, 'manages');

    const assetCat = getOrCreateNode('cat_investments_assets', 'Investments & Assets', 'other', 'Mutual funds, index funds, REITs, bonds, and brokerage platforms', { is_category: true, domain: 'Finance & Wealth', level: 2 });
    addEdgeIfMissing(finHub.temp_id, assetCat.temp_id, 'category');

    for (const fin of financeEntities) {
      removeDirectMeEdge(fin.temp_id);
      addEdgeIfMissing(assetCat.temp_id, fin.temp_id, 'asset');
    }
  }

  // =========================================================================
  // 7. International Relocation Multi-Tier Hierarchy:
  // Me -> International Relocation -> Target Countries -> US, Canada...
  // =========================================================================
  const countryEntities = newEntities.filter(
    e => TARGET_COUNTRY_REGEX.test(e.name) && e.temp_id !== 'me'
  );

  if (countryEntities.length > 0) {
    const relocHub = getOrCreateNode('hub_relocation', 'International Relocation', 'other', 'Target countries and global mobility opportunities', { is_domain_hub: true, level: 1 });
    addEdgeIfMissing('me', relocHub.temp_id, 'aiming_for');

    const targetCountriesCat = getOrCreateNode('cat_target_countries', 'Target Countries', 'other', 'Destination countries for relocation and career expansion', { is_category: true, domain: 'International Relocation', level: 2 });
    addEdgeIfMissing(relocHub.temp_id, targetCountriesCat.temp_id, 'category');

    for (const country of countryEntities) {
      removeDirectMeEdge(country.temp_id);
      addEdgeIfMissing(targetCountriesCat.temp_id, country.temp_id, 'target_country');
    }
  }

  // =========================================================================
  // 8. Food & Dietary Preferences Multi-Tier Hierarchy:
  // Me -> Food Preferences -> Favorite Dishes -> Dosa, Idli...
  //                        -> Avoided Foods -> Bitter gourd...
  // =========================================================================
  const favFoodEntities = newEntities.filter(
    e => (e.type === 'dish' || FOOD_LIKES_REGEX.test(e.name)) && !FOOD_DISLIKES_REGEX.test(e.name) && e.temp_id !== 'me'
  );
  const avoidFoodEntities = newEntities.filter(
    e => FOOD_DISLIKES_REGEX.test(e.name) && e.temp_id !== 'me'
  );

  if (favFoodEntities.length > 0 || avoidFoodEntities.length > 0) {
    const foodHub = getOrCreateNode('hub_food_prefs', 'Food Preferences', 'other', 'South Indian cuisine staples, favorite comfort foods, and avoided foods', { is_domain_hub: true, level: 1 });
    addEdgeIfMissing('me', foodHub.temp_id, 'has_preference');

    if (favFoodEntities.length > 0) {
      const favCat = getOrCreateNode('cat_fav_dishes', 'Favorite Dishes', 'other', 'Beloved comfort foods and staple South Indian dishes', { is_category: true, domain: 'Food Preferences', level: 2 });
      addEdgeIfMissing(foodHub.temp_id, favCat.temp_id, 'category');

      for (const food of favFoodEntities) {
        removeDirectMeEdge(food.temp_id);
        addEdgeIfMissing(favCat.temp_id, food.temp_id, 'favorite_dish');
      }
    }

    if (avoidFoodEntities.length > 0) {
      const avoidCat = getOrCreateNode('cat_avoided_foods', 'Avoided Foods', 'other', 'Disliked vegetables and avoided ingredients', { is_category: true, domain: 'Food Preferences', level: 2 });
      addEdgeIfMissing(foodHub.temp_id, avoidCat.temp_id, 'category');

      for (const food of avoidFoodEntities) {
        removeDirectMeEdge(food.temp_id);
        addEdgeIfMissing(avoidCat.temp_id, food.temp_id, 'avoids');
      }
    }
  }

  // =========================================================================
  // 9. Geographic Hierarchy:
  // Karnataka -> Bangalore, Mysore
  // =========================================================================
  const karnataka = newEntities.find(e => e.name.toLowerCase() === 'karnataka');
  const bangalore = newEntities.find(e => e.name.toLowerCase() === 'bangalore' || e.name.toLowerCase() === 'bengaluru');
  const mysore = newEntities.find(e => e.name.toLowerCase() === 'mysore' || e.name.toLowerCase() === 'mysuru');

  if (karnataka) {
    if (bangalore) {
      addEdgeIfMissing(karnataka.temp_id, bangalore.temp_id, 'contains_city');
    }
    if (mysore) {
      addEdgeIfMissing(karnataka.temp_id, mysore.temp_id, 'contains_city');
      removeDirectMeEdge(mysore.temp_id);
    }
  }

  // =========================================================================
  // 10. UNIVERSAL TRANSITIVE BYPASS PRUNER (ZERO DANDELION / STAR GUARANTEE)
  // Any entity that has a parent in the category, hardware, or intermediate hierarchy
  // is STRICTLY FORBIDDEN from having a direct edge to/from Root User (Me).
  // =========================================================================
  const domainHubIds = new Set<string>();
  const categoryNodeIds = new Set<string>();

  for (const ent of newEntities) {
    if (ent.props?.is_domain_hub || isDomainHubName(ent.name)) {
      domainHubIds.add(ent.temp_id);
    }
    if (ent.props?.is_category || isCategoryName(ent.name)) {
      categoryNodeIds.add(ent.temp_id);
    }
  }

  for (const edge of newEdges) {
    const s = canonicalIdMap.get(edge.src_temp_id) || edge.src_temp_id;
    const d = canonicalIdMap.get(edge.dst_temp_id) || edge.dst_temp_id;
    if (edge.relation === 'category') {
      domainHubIds.add(s);
      categoryNodeIds.add(d);
    }
  }

  // Identify all entities that have an incoming edge from a non-'me' node
  const entitiesWithHierarchyParent = new Set<string>();
  for (const edge of newEdges) {
    const s = canonicalIdMap.get(edge.src_temp_id) || edge.src_temp_id;
    const d = canonicalIdMap.get(edge.dst_temp_id) || edge.dst_temp_id;
    if (s !== 'me') {
      entitiesWithHierarchyParent.add(d);
    }
  }

  // Entities permitted to connect directly to Root User (Me):
  const isPermittedDirectAnchor = (ent: RawEntity): boolean => {
    // 1. Domain Hubs
    if (domainHubIds.has(ent.temp_id) || isDomainHubName(ent.name)) return true;
    // 2. Direct family members
    if (ent.type === 'person' && /parents|mother|father|mom|dad|wife|husband|brother|sister/i.test(ent.name)) return true;
    // 3. Primary employer
    if (ent.type === 'org' && /neustar|transunion/i.test(ent.name)) return true;
    // 4. Primary current residence or state of origin
    if (ent.type === 'place' && /bangalore|bengaluru|karnataka/i.test(ent.name)) return true;
    // 5. Direct autobiographical life events
    if (ent.type === 'event' && /trip|vacation|wedding|graduation|birth/i.test(ent.name)) return true;
    // 6. Direct psychological mind state
    if (ent.name.toLowerCase().includes('reflection') || ent.name.toLowerCase().includes('reset')) return true;
    return false;
  };

  const finalEdges: RawEdge[] = [];
  for (const edge of newEdges) {
    const s = canonicalIdMap.get(edge.src_temp_id) || edge.src_temp_id;
    const d = canonicalIdMap.get(edge.dst_temp_id) || edge.dst_temp_id;

    const isDirectMeEdge = (s === 'me' && d !== 'me') || (d === 'me' && s !== 'me');

    if (isDirectMeEdge) {
      const targetTempId = s === 'me' ? d : s;
      const targetEntity = newEntities.find(e => e.temp_id === targetTempId);

      // If the target is nested under a parent, or is a leaf item not in permitted anchors:
      if (targetEntity && (entitiesWithHierarchyParent.has(targetTempId) || !isPermittedDirectAnchor(targetEntity))) {
        // Preserve user action as a discrete fact on the entity
        if (edge.relation && !['explores', 'passionate_about', 'aiming_for', 'has_preference', 'enjoys', 'trains', 'works_in', 'manages', 'travels_to', 'reflected_on'].includes(edge.relation)) {
          const alreadyHasStatus = facts.some(f => f.entity_temp_id === targetTempId && (f.key === 'status' || f.key === 'user_action'));
          if (!alreadyHasStatus) {
            facts.push({
              entity_temp_id: targetTempId,
              key: 'status',
              value: edge.relation
            });
          }
        }
        // PRUNE THE BYPASS SPOKE!
        continue;
      }
    }

    // PRUNE LEVEL 1 (DOMAIN HUB) TO LEVEL 3 (LEAF) BYPASS EDGES:
    // If an edge connects a Domain Hub to a leaf entity, but that leaf entity
    // already has a Category parent, PRUNE the direct Domain Hub shortcut.
    const isDomainHubEdge = (domainHubIds.has(s) && !categoryNodeIds.has(d)) || 
                            (domainHubIds.has(d) && !categoryNodeIds.has(s));

    if (isDomainHubEdge) {
      const leafId = domainHubIds.has(s) ? d : s;
      const hasCategoryParent = newEdges.some(
        e => {
          const es = canonicalIdMap.get(e.src_temp_id) || e.src_temp_id;
          const ed = canonicalIdMap.get(e.dst_temp_id) || e.dst_temp_id;
          return categoryNodeIds.has(es) && ed === leafId;
        }
      );
      if (hasCategoryParent) {
        // Prune the Domain Hub -> Leaf shortcut!
        continue;
      }
    }

    // Prune reverse 'part_of' or 'involves' edges if a canonical downward edge exists
    if (edge.relation === 'part_of') {
      const hasDownward = newEdges.some(
        e => {
          const es = canonicalIdMap.get(e.src_temp_id) || e.src_temp_id;
          const ed = canonicalIdMap.get(e.dst_temp_id) || e.dst_temp_id;
          return es === d && ed === s && e.relation !== 'part_of';
        }
      );
      if (hasDownward) continue;
    }

    finalEdges.push({
      ...edge,
      src_temp_id: s,
      dst_temp_id: d
    });
  }

  // =========================================================================
  // 11. CANONICAL EDGE PAIR DEDUPLICATION & DIRECTED HIERARCHY
  // Enforce single downward edge (Domain -> Category -> Entity -> Subcomponent)
  // Drop redundant reverse edges (e.g. Item --part_of--> Category when Category --equipment--> Item exists)
  // =========================================================================
  const canonicalEdges: RawEdge[] = [];
  const edgePairMap = new Map<string, RawEdge>();

  // High-priority downward hierarchical relations
  const canonicalRelations = [
    'category',
    'platform',
    'camera_body',
    'has_lens',
    'equipment',
    'project',
    'series',
    'movie',
    'game',
    'exercise',
    'facility',
    'hardware',
    'asset',
    'target_country',
    'favorite_dish',
    'avoids',
    'connection',
    'contains_city',
    'includes',
    'contains'
  ];

  for (const edge of finalEdges) {
    const s = edge.src_temp_id;
    const d = edge.dst_temp_id;
    if (s === d) continue;

    const pairKey = [s, d].sort().join('<->');
    const existing = edgePairMap.get(pairKey);

    if (!existing) {
      edgePairMap.set(pairKey, edge);
      canonicalEdges.push(edge);
    } else {
      // If the new edge has a canonical downward relation and the existing does not, swap!
      if (!canonicalRelations.includes(existing.relation) && canonicalRelations.includes(edge.relation)) {
        const idx = canonicalEdges.indexOf(existing);
        if (idx >= 0) canonicalEdges[idx] = edge;
        edgePairMap.set(pairKey, edge);
      }
    }
  }

  // =========================================================================
  // 12. UNIVERSAL ROOT ATTACHMENT GUARANTEE (NO DISCONNECTED ISLANDS)
  // Every domain hub and top-level anchor in the extracted graph MUST connect to 'Me'.
  // =========================================================================
  for (const ent of newEntities) {
    if (ent.temp_id === 'me') continue;
    if (ent.props?.is_domain_hub || isDomainHubName(ent.name)) {
      const isConnectedToMe = canonicalEdges.some(
        e => (e.src_temp_id === 'me' && e.dst_temp_id === ent.temp_id) ||
             (e.dst_temp_id === 'me' && e.src_temp_id === ent.temp_id)
      );
      if (!isConnectedToMe) {
        const domHub = getCanonicalDomainHub(ent.name);
        const rel = domHub?.defaultRelation || 'focuses_on';
        canonicalEdges.push({
          src_temp_id: 'me',
          dst_temp_id: ent.temp_id,
          relation: rel,
          props: {}
        });
      }
    }
  }

  // Clean up any unlinked placeholder entities (e.g. generic 'Exercises' if shadowed)
  const connectedNodeIds = new Set<string>();
  for (const edge of canonicalEdges) {
    connectedNodeIds.add(edge.src_temp_id);
    connectedNodeIds.add(edge.dst_temp_id);
  }

  const finalEntities = newEntities.filter(
    e => e.temp_id === 'me' || connectedNodeIds.has(e.temp_id)
  );

  return {
    entities: finalEntities,
    edges: canonicalEdges,
    facts
  };
}
