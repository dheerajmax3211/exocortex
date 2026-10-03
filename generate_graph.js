const fs = require('fs');

const code = `import { getEmbedding } from './embeddings';

/**
 * Multi-Tier Graph Hierarchy & Universal Anti-Bypass Engine
 * 
 * Guarantees pure hierarchical tree/DAG topology with arbitrary depth N >= 3:
 * Level 0: Root User (Me)
 *  └── Level 1: Domain Hubs
 *       └── Level 2: Category Nodes
 *            └── Level 3: Entities
 * 
 * UNIVERSAL INVARIANTS:
 * 1. STRICT ZERO DANDELION / STAR SPOKES
 * 2. NO DISCONNECTED ISLANDS
 * 3. SINGLE CANONICAL DOWNWARD DIRECTION
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

export const DOMAIN_HUB_DEFINITIONS = [
  {
    name: 'Photography',
    aliases: ['photography', 'photography & filmmaking', 'filmmaking', 'camera & optics', 'photo', 'optics'],
    summary: 'Photography, camera equipment, lighting setups, and filmmaking projects',
    defaultRelation: 'passionate_about',
    hub_id: 'hub_photography'
  },
  {
    name: 'Media & Entertainment',
    aliases: ['media & entertainment', 'media', 'entertainment', 'movies & shows', 'cinema', 'pop culture', 'gaming', 'audiobooks & literature', 'books', 'shows'],
    summary: 'Movies, television series, literature, audiobooks, and gaming',
    defaultRelation: 'enjoys',
    hub_id: 'hub_media'
  },
  {
    name: 'Health & Fitness',
    aliases: ['health & fitness', 'fitness', 'gym & fitness', 'workouts', 'body & fitness', 'exercise', 'training', 'athletics', 'lifting', 'health'],
    summary: 'Strength workouts, gym routines, physique development, and health metrics',
    defaultRelation: 'trains',
    hub_id: 'hub_fitness'
  },
  {
    name: 'Dating & Relationships',
    aliases: ['dating & relationships', 'dating', 'relationships', 'romance', 'matrimonial', 'dating platforms', 'personal connections'],
    summary: 'Dating platforms, romantic interests, social connections, and relationship goals',
    defaultRelation: 'explores',
    hub_id: 'hub_dating'
  },
  {
    name: 'Career & Professional',
    aliases: ['career & professional', 'career', 'work', 'job', 'software engineering', 'professional', 'engineering', 'tech stack', 'computing'],
    summary: 'Professional career, employer, tech stack, software engineering, and skills',
    defaultRelation: 'works_in',
    hub_id: 'hub_career'
  },
  {
    name: 'Finance & Wealth',
    aliases: ['finance & wealth', 'finances', 'finance', 'wealth', 'money', 'investments', 'budget', 'portfolio', 'stocks', 'crypto', 'savings'],
    summary: 'Investments, mutual funds, personal budget, wealth targets, and debt management',
    defaultRelation: 'manages',
    hub_id: 'hub_finance'
  },
  {
    name: 'Travel & Places',
    aliases: ['travel & places', 'travel', 'trips', 'places', 'geography', 'vacations', 'cities', 'destinations'],
    summary: 'Travel journeys, destinations, vacations, and geographic locations',
    defaultRelation: 'travels_to',
    hub_id: 'hub_travel'
  },
  {
    name: 'Food Preferences',
    aliases: ['food preferences', 'food', 'diet', 'cuisine', 'meals', 'nutrition', 'dishes', 'comfort foods'],
    summary: 'South Indian cuisine staples, favorite dishes, and avoided foods',
    defaultRelation: 'has_preference',
    hub_id: 'hub_food_prefs'
  },
  {
    name: 'International Relocation',
    aliases: ['international relocation', 'relocation', 'immigration', 'moving abroad', 'target countries'],
    summary: 'Target countries and global mobility opportunities for career expansion',
    defaultRelation: 'aiming_for',
    hub_id: 'hub_relocation'
  },
  {
    name: 'Mind & Philosophy',
    aliases: ['mind & philosophy', 'mindset', 'philosophy', 'self-reflection', 'personal growth', 'psychology'],
    summary: 'Life philosophy, mindset, personal reflections, and identity reset',
    defaultRelation: 'reflected_on',
    hub_id: 'hub_mind'
  }
];

export const DOMAIN_HUBS = DOMAIN_HUB_DEFINITIONS.map(d => d.name);

export const CATEGORY_DEFINITIONS = [
  { name: 'Camera Equipment', domain: 'Photography', relation: 'equipment', summary: 'Cameras, bodies, lenses, optics, and accessories', cat_id: 'cat_camera_equip' },
  { name: 'Lighting Equipment', domain: 'Photography', relation: 'equipment', summary: 'Studio strobes, continuous LED lights, and modifiers', cat_id: 'cat_lighting_equip' },
  { name: 'Creative Projects', domain: 'Photography', relation: 'project', summary: 'Short films, video productions, and shoots', cat_id: 'cat_creative_proj' },
  { name: 'Television & Series', domain: 'Media & Entertainment', relation: 'series', summary: 'TV shows, sitcoms, and series', cat_id: 'cat_tv_series' },
  { name: 'Films & Cinema', domain: 'Media & Entertainment', relation: 'movie', summary: 'Feature films and cinema', cat_id: 'cat_films_cinema' },
  { name: 'Audiobooks & Literature', domain: 'Media & Entertainment', relation: 'platform', summary: 'Audiobooks, podcasts, and reading platforms', cat_id: 'cat_audio_lit' },
  { name: 'Gaming', domain: 'Media & Entertainment', relation: 'game', summary: 'Video games and mobile gaming', cat_id: 'cat_gaming' },
  { name: 'Podcasts & Audio', domain: 'Media & Entertainment', relation: 'podcast', summary: 'Podcasts and audio discussions', cat_id: 'cat_podcasts' },
  { name: 'Dating Platforms', domain: 'Dating & Relationships', relation: 'platform', summary: 'Dating apps and matrimonial discovery', cat_id: 'cat_dating_platforms' },
  { name: 'Personal Connections', domain: 'Dating & Relationships', relation: 'connection', summary: 'Romantic interests and social dates', cat_id: 'cat_personal_connections' },
  { name: 'Strength Training', domain: 'Health & Fitness', relation: 'exercise', summary: 'Barbell, dumbbell, calisthenics, and benchmark workouts', cat_id: 'cat_strength_training' },
  { name: 'Gyms & Facilities', domain: 'Health & Fitness', relation: 'facility', summary: 'Gym memberships and fitness training facilities', cat_id: 'cat_gyms_facilities' },
  { name: 'Fitness Tracking', domain: 'Health & Fitness', relation: 'tracker', summary: 'Health monitors, watches, and metric tracking', cat_id: 'cat_fitness_tracking' },
  { name: 'Sports & Athletics', domain: 'Health & Fitness', relation: 'sport', summary: 'Sports and athletic activities', cat_id: 'cat_sports' },
  { name: 'Tech Stack & Skills', domain: 'Career & Professional', relation: 'skill', summary: 'Software engineering skills and technologies', cat_id: 'cat_tech_stack' },
  { name: 'Computing Hardware', domain: 'Career & Professional', relation: 'hardware', summary: 'Workstation peripherals, mechanical keyboards, laptops, and gadgets', cat_id: 'cat_computing_hw' },
  { name: 'Colleagues & Network', domain: 'Career & Professional', relation: 'colleague', summary: 'Professional contacts and network', cat_id: 'cat_colleagues' },
  { name: 'Productivity Tools', domain: 'Career & Professional', relation: 'tool', summary: 'Software tools for productivity', cat_id: 'cat_productivity' },
  { name: 'Investments & Assets', domain: 'Finance & Wealth', relation: 'asset', summary: 'Mutual funds, index funds, REITs, bonds, and brokerage platforms', cat_id: 'cat_investments_assets' },
  { name: 'Debt & Loans', domain: 'Finance & Wealth', relation: 'debt', summary: 'Loans and debt management', cat_id: 'cat_debt' },
  { name: 'Budget & Spending', domain: 'Finance & Wealth', relation: 'budget', summary: 'Budget and spending categories', cat_id: 'cat_budget' },
  { name: 'Destinations & Cities', domain: 'Travel & Places', relation: 'destination', summary: 'Travel destinations and cities', cat_id: 'cat_destinations' },
  { name: 'Trips & Vacations', domain: 'Travel & Places', relation: 'trip', summary: 'Vacations and travel itineraries', cat_id: 'cat_trips' },
  { name: 'Favorite Dishes', domain: 'Food Preferences', relation: 'favorite_dish', summary: 'Beloved comfort foods and staple South Indian dishes', cat_id: 'cat_fav_dishes' },
  { name: 'Avoided Foods', domain: 'Food Preferences', relation: 'avoids', summary: 'Disliked vegetables and avoided ingredients', cat_id: 'cat_avoided_foods' },
  { name: 'Restaurants & Cafes', domain: 'Food Preferences', relation: 'restaurant', summary: 'Dining out and restaurants', cat_id: 'cat_restaurants' },
  { name: 'Target Countries', domain: 'International Relocation', relation: 'target_country', summary: 'Destination countries for relocation and career expansion', cat_id: 'cat_target_countries' },
  { name: 'Self-Reflection & Goals', domain: 'Mind & Philosophy', relation: 'reflection', summary: 'Life philosophy, mindset, personal reflections, and identity reset', cat_id: 'cat_reflection' }
];

export const CATEGORY_NAMES = CATEGORY_DEFINITIONS.map(c => c.name);

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

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function restructureHierarchicalExtraction(
  entities: RawEntity[],
  edges: RawEdge[],
  facts: RawFact[],
  candidates: ExistingCandidate[] = []
): Promise<{ entities: RawEntity[]; edges: RawEdge[]; facts: RawFact[] }> {
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

  // Pre-compute embeddings for categories
  const categoryEmbeddings = await Promise.all(
    CATEGORY_DEFINITIONS.map(async cat => {
      const emb = await getEmbedding(cat.name + " " + cat.summary);
      return { cat, emb };
    })
  );

  // Filter out nodes that should not be dynamically classified
  const unclassifiedEntities = newEntities.filter(e => 
    e.temp_id !== 'me' && 
    !isDomainHubName(e.name) && 
    !isCategoryName(e.name) &&
    !e.props?.is_domain_hub &&
    !e.props?.is_category &&
    e.type !== 'person' && // Keep people independent unless matched
    e.type !== 'place' &&  // Geographic handled separately
    e.type !== 'event'     // Events handled separately
  );

  // Dynamically Classify Entities
  for (const ent of unclassifiedEntities) {
    const entText = \`\${ent.name} \${ent.summary || ''} \${ent.type}\`;
    const entEmb = await getEmbedding(entText);
    
    let bestCat = null;
    let bestScore = -1;
    
    for (const { cat, emb } of categoryEmbeddings) {
      const score = cosineSimilarity(entEmb, emb);
      if (score > bestScore) {
        bestScore = score;
        bestCat = cat;
      }
    }

    // Connect to best category if similarity is acceptable
    if (bestCat && bestScore > 0.4) {
      const domHubDef = DOMAIN_HUB_DEFINITIONS.find(d => d.name === bestCat.domain)!;
      
      const hubNode = getOrCreateNode(
        domHubDef.hub_id, 
        domHubDef.name, 
        'other', 
        domHubDef.summary, 
        { is_domain_hub: true, level: 1 }
      );
      addEdgeIfMissing('me', hubNode.temp_id, domHubDef.defaultRelation);

      const catNode = getOrCreateNode(
        bestCat.cat_id, 
        bestCat.name, 
        'other', 
        bestCat.summary, 
        { is_category: true, domain: bestCat.domain, level: 2 }
      );
      addEdgeIfMissing(hubNode.temp_id, catNode.temp_id, 'category');

      removeDirectMeEdge(ent.temp_id);
      addEdgeIfMissing(catNode.temp_id, ent.temp_id, bestCat.relation);
    }
  }

  // =========================================================================
  // Geographic Hierarchy (Keep)
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
  // UNIVERSAL TRANSITIVE BYPASS PRUNER (ZERO DANDELION / STAR GUARANTEE)
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

  const entitiesWithHierarchyParent = new Set<string>();
  for (const edge of newEdges) {
    const s = canonicalIdMap.get(edge.src_temp_id) || edge.src_temp_id;
    const d = canonicalIdMap.get(edge.dst_temp_id) || edge.dst_temp_id;
    if (s !== 'me') {
      entitiesWithHierarchyParent.add(d);
    }
  }

  const isPermittedDirectAnchor = (ent: RawEntity): boolean => {
    if (domainHubIds.has(ent.temp_id) || isDomainHubName(ent.name)) return true;
    if (ent.type === 'person' && /parents|mother|father|mom|dad|wife|husband|brother|sister/i.test(ent.name)) return true;
    if (ent.type === 'org' && /neustar|transunion/i.test(ent.name)) return true;
    if (ent.type === 'place' && /bangalore|bengaluru|karnataka/i.test(ent.name)) return true;
    if (ent.type === 'event' && /trip|vacation|wedding|graduation|birth/i.test(ent.name)) return true;
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

      if (targetEntity && (entitiesWithHierarchyParent.has(targetTempId) || !isPermittedDirectAnchor(targetEntity))) {
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
        continue;
      }
    }

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
        continue;
      }
    }

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
  // CANONICAL EDGE PAIR DEDUPLICATION & DIRECTED HIERARCHY
  // =========================================================================
  const canonicalEdges: RawEdge[] = [];
  const edgePairMap = new Map<string, RawEdge>();

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
    'contains',
    'podcast',
    'tracker',
    'sport',
    'skill',
    'colleague',
    'tool',
    'debt',
    'budget',
    'destination',
    'trip',
    'restaurant',
    'reflection'
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
      if (!canonicalRelations.includes(existing.relation) && canonicalRelations.includes(edge.relation)) {
        const idx = canonicalEdges.indexOf(existing);
        if (idx >= 0) canonicalEdges[idx] = edge;
        edgePairMap.set(pairKey, edge);
      }
    }
  }

  // =========================================================================
  // UNIVERSAL ROOT ATTACHMENT GUARANTEE
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
`

fs.writeFileSync('/Users/dheerajsrinivasa/Documents/essentials/VirtualDheeraj/src/lib/graph-hierarchy.ts', code, 'utf-8');
