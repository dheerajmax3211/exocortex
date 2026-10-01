import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { chatJSON } from '../src/lib/llm';
import { z } from 'zod';
import { restructureHierarchicalExtraction } from '../src/lib/graph-hierarchy';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const extractionSchema = z.object({
  event_date: z.string().nullable(),
  date_end: z.string().nullable(),
  date_precision: z.enum(['day', 'month', 'year', 'period', 'unknown']).default('unknown'),
  entities: z.array(z.object({
    temp_id: z.string(),
    type: z.enum(['person', 'place', 'restaurant', 'dish', 'movie', 'show', 'book', 'school', 'org', 'period', 'event', 'item', 'other']),
    name: z.string(),
    aliases: z.array(z.string()).default([]),
    summary: z.string().nullable().optional(),
    props: z.record(z.string(), z.any()).default({}),
    match: z.object({
      existing_id: z.string().nullable(),
      confidence: z.number(),
      candidate_names: z.array(z.string()).optional()
    }).nullable().optional()
  })),
  edges: z.array(z.object({
    src_temp_id: z.string(),
    dst_temp_id: z.string(),
    relation: z.string(),
    props: z.record(z.string(), z.any()).default({})
  })),
  facts: z.array(z.object({
    entity_temp_id: z.string(),
    key: z.string(),
    value: z.string()
  })),
  event: z.object({
    name: z.string(),
    summary: z.string()
  }).nullable().optional(),
  questions: z.array(z.string()).default([])
});

async function runTest() {
  console.log('🧪 Testing AI Extraction with World Knowledge & Deep Hierarchy...\n');

  // 1. Fetch user & all candidate entities
  const { data: users } = await supabase.from('entities').select('*').contains('props', { is_user: true });
  const me = users![0];

  const { data: allEntities } = await supabase
    .from('entities')
    .select('id, name, type, aliases, summary, props')
    .eq('user_id', me.user_id)
    .is('deleted_at', null)
    .limit(200);

  const candidates: any[] = allEntities || [];
  candidates.unshift({
    id: me.id,
    type: 'person',
    name: me.name,
    aliases: me.aliases || ['me', 'i', 'myself'],
    summary: 'The user / author of these memories'
  });

  const testInputs = [
    "I just watched himym and loved the ending, especially the blue french horn scene",
    "Got a new viltrox 35mm f1.8 lens for my z50, autofocus is super fast",
    "My sk400 light was flickering today during our shoot, might need a fuse replacement"
  ];

  const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const currentDay = new Date().toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

  const systemPrompt = `You are the knowledge graph extraction and reasoning engine for Virtual Brain (a personal memory and life operating system).
Current Time in IST: ${currentIst} (${currentDay}).

ROOT USER IDENTITY (CRITICAL):
- The author/owner of this brain is: "${me.name}" (ID: "${me.id}", Aliases: ${JSON.stringify(me.aliases || [])}).
- When the memory refers to "I", "me", "my", "myself", or the user states their name/identity, they are ALWAYS the root user.
- NEVER create a separate 'person' entity for the user! Use temp_id='me' for the user.
- If the user states biographical details, attach them as facts to temp_id='me'.

1. WORLD KNOWLEDGE, ACRONYM EXPANSION & CANONICALIZATION (CRITICAL):
- The user writes casually and may use colloquial abbreviations, pop-culture acronyms, equipment model names, or misspellings.
- YOU MUST USE DEEP WORLD KNOWLEDGE TO EXPAND SLANG, ACRONYMS, AND INFORMAL REFERENCES INTO CANONICAL TITLES:
  * "himym" -> Canonical Name: "How I Met Your Mother", Type: "show", Aliases: ["himym", "HIMYM"], Summary: "CBS comedy sitcom television series created by Craig Thomas and Carter Bays".
  * "got" (in media context) -> Canonical Name: "Game of Thrones", Type: "show", Aliases: ["got", "GoT"].
  * "bb" (in media context) -> Canonical Name: "Breaking Bad", Type: "show", Aliases: ["bb", "Breaking Bad"].
  * "b99" -> Canonical Name: "Brooklyn Nine-Nine", Type: "show", Aliases: ["b99"].
  * "z50" or "nikon z50" -> Canonical Name: "Nikon Z50", Type: "item", Aliases: ["z50", "Z50"].
  * "sk400" or "sk400 kit" -> Canonical Name: "Godox SK400 Studio Strobe", Type: "item", Aliases: ["sk400", "SK400 setup", "sk400 kit"].
  * "lc500r" or "godox light stick" -> Canonical Name: "Godox LC500R Light Stick", Type: "item", Aliases: ["lc500r", "LC500R"].
  * "viltrox 24mm f1.8" -> Canonical Name: "Viltrox AF 24mm f/1.8 Lens", Type: "item", Aliases: ["24mm lens", "viltrox 24mm"].
  * "viltrox 56mm f1.4" -> Canonical Name: "Viltrox AF 56mm f/1.4 Lens", Type: "item", Aliases: ["56mm f/1.4 lens", "viltrox 56mm"].
  * "viltrox 35mm f1.8" -> Canonical Name: "Viltrox AF 35mm f/1.8 Lens", Type: "item", Aliases: ["35mm lens", "viltrox 35mm"].
  * "mcoc" -> Canonical Name: "Marvel Contest of Champions", Type: "other", Aliases: ["mcoc", "MCoC"].
- ALWAYS set the entity 'name' to the full, canonical title.
- Store the user's exact slang or shorthand in 'aliases' so future mentions immediately match!

2. ASSIGN TO EXISTING NODES OR UPDATE EXISTING NODES (DEDUPLICATION):
- Inspect "Candidate Existing Entities in Graph".
- If the user's text refers to, discusses, or updates an entity that already exists in candidates:
  YOU MUST SET: match: { existing_id: "<candidate.id>", confidence: 1.0 }
- Extract all new facts, states, opinions, ratings, or updates (e.g. key='last_watched', value='season 9 finale', key='status', value='battery drained') and attach them to that entity!
- DO NOT invent duplicate entities for concepts that already exist in the graph!

3. MULTI-TIER DEEP ONTOLOGY (ARBITRARY DEPTH N >= 3):
- CRITICAL: DO NOT build flat dandelion star-graphs from 'me'!
- Organize entities into structured multi-tier trees using intermediate category nodes:
  * PHOTOGRAPHY MULTI-TIER TREE:
    'me' -> passionate_about -> "Photography" (Level 1: Domain)
    "Photography" -> category -> "Camera Equipment" (Level 2: Category)
    "Camera Equipment" -> camera_body -> "Nikon Z50" (Level 3: Body)
    "Nikon Z50" -> has_lens -> "Viltrox 56mm f/1.4 Lens", "Viltrox 24mm f/1.8 Lens", "16-50mm kit lens", etc. (Level 4: Optics)
    "Photography" -> category -> "Lighting Equipment" (Level 2: Category)
    "Lighting Equipment" -> equipment -> "Godox LC500R", "SK400 setup" (Level 3: Gear)
    "Photography" -> category -> "Creative Projects" (Level 2: Category)
    "Creative Projects" -> project -> "Short-film project" (Level 3: Event)
  * MEDIA & ENTERTAINMENT MULTI-TIER TREE:
    'me' -> enjoys -> "Media & Entertainment" (Level 1: Domain)
    "Media & Entertainment" -> category -> "Television & Series" (Level 2: Category)
    "Television & Series" -> series -> "How I Met Your Mother" (Level 3: Show)
    'me' -> watched -> "How I Met Your Mother" (with props: { status: 'watched', rating_10: ..., quote: ... })
    "Media & Entertainment" -> category -> "Films & Cinema" (Level 2: Category)
    "Films & Cinema" -> movie -> "Catch Me If You Can" (Level 3: Movie)
    "Media & Entertainment" -> category -> "Gaming" (Level 2: Category)
    "Gaming" -> game -> "Marvel Contest of Champions" (Level 3: Game)
    "Media & Entertainment" -> category -> "Audiobooks & Literature" (Level 2: Category)
    "Audiobooks & Literature" -> platform -> "Audible" (Level 3: Platform)

4. Dates & Facts:
- Resolve relative dates against current date and Known Life Periods.
- Extract ALL granular facts into the facts array.`;

  const candidateContext = JSON.stringify(candidates.map(c => ({ id: c.id, type: c.type, name: c.name, aliases: c.aliases, summary: c.summary })), null, 2);

  for (const text of testInputs) {
    console.log(`\n============================================================`);
    console.log(`📝 INPUT: "${text}"`);
    console.log(`============================================================`);

    const result = await chatJSON({
      system: systemPrompt,
      prompt: `Raw Memory Entry:\n"${text}"\n\nCandidate Existing Entities in Graph:\n${candidateContext}\n\nKnown Life Periods:\n[]`,
      schema: extractionSchema
    });

    const hierarchical = await restructureHierarchicalExtraction(
      result.entities,
      result.edges,
      result.facts,
      candidates
    );

    console.log('\n--- EXTRACTED ENTITIES ---');
    for (const ent of hierarchical.entities) {
      const matchStr = ent.match?.existing_id ? `[MATCHED EXISTING ID: ${ent.match.existing_id}]` : '[NEW NODE]';
      console.log(`  • "${ent.name}" (${ent.type}) ${matchStr} | Aliases: ${JSON.stringify(ent.aliases || [])}`);
    }

    console.log('\n--- HIERARCHICAL EDGES (DAG) ---');
    const entNameMap = Object.fromEntries(hierarchical.entities.map(e => [e.temp_id, e.name]));
    for (const edge of hierarchical.edges) {
      const s = edge.src_temp_id === 'me' ? 'Dheeraj Srinivasa' : (entNameMap[edge.src_temp_id] || edge.src_temp_id);
      const d = edge.dst_temp_id === 'me' ? 'Dheeraj Srinivasa' : (entNameMap[edge.dst_temp_id] || edge.dst_temp_id);
      console.log(`  ${s} --[${edge.relation}]--> ${d}`);
    }

    console.log('\n--- DISCRETE FACTS EXTRACTED ---');
    for (const f of hierarchical.facts) {
      const entName = f.entity_temp_id === 'me' ? 'Dheeraj Srinivasa' : (entNameMap[f.entity_temp_id] || f.entity_temp_id);
      console.log(`  [${entName}] ${f.key}: "${f.value}"`);
    }
  }
}

runTest().catch(console.error);
