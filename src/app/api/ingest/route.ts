import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { stringSimilarity } from '@/lib/entity-resolution';
import { z } from 'zod';

const extractionSchema = z.object({
  event_date: z.string().nullable().describe("YYYY-MM-DD date if this relates to a specific day, else null"),
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

function chunkText(text: string, maxChunkSize = 7000): string[] {
  if (text.length <= maxChunkSize) return [text];
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) return [text];

  const chunks: string[] = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if (!currentChunk) {
      currentChunk = p;
    } else if (currentChunk.length + p.length + 2 <= maxChunkSize) {
      currentChunk += '\n\n' + p;
    } else {
      chunks.push(currentChunk);
      currentChunk = p;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, source } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const url = new URL(req.url);
    const isAsync = url.searchParams.get('async') === 'true' || req.headers.get('x-async') === 'true';

    // 1. Save verbatim raw text to entries
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: user.id,
        raw_text: text,
        source: source || 'typed',
        status: isAsync ? 'extracting' : 'draft'
      })
      .select('id')
      .single();

    if (entryError) {
      console.error('Entry insert error:', entryError);
      return NextResponse.json({ error: 'Failed to save raw entry' }, { status: 500 });
    }

    const extractionCache = (globalThis as any).__extractionCache || ((globalThis as any).__extractionCache = new Map());
    if (isAsync) {
      extractionCache.set(entry.id, { status: 'extracting' });
    }

    const extractionTask = async () => {
      try {
        // We need a fresh client for background tasks if running async, but createClient in nextjs 
        // uses cookies which might not be accessible in background context after response.
        // For simplicity we will use the same supabase client, though in Edge/Vercel it might fail.
        // Actually, we can just use the provided client since it's a standard serverless function.
        
        // 2. Comprehensive Graph Taxonomy & Candidate Retrieval
        const { retrieveHighRecallCandidates } = await import('@/lib/entity-resolution');
        const { getOrCreateMeEntity } = await import('@/lib/db');
        const me = await getOrCreateMeEntity(supabase, user.id);

        // Fetch all active entities (up to 200) to give LLM complete taxonomy visibility
        const { data: allUserEntities } = await supabase
          .from('entities')
          .select('id, name, type, aliases, summary, props')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .limit(200);

        const highRecall = await retrieveHighRecallCandidates(supabase, user.id, text);
        const candidateMap = new Map<string, any>();
        for (const e of allUserEntities || []) {
          candidateMap.set(e.id, e);
        }
        for (const h of highRecall) {
          candidateMap.set(h.id, h);
        }

        const candidates: any[] = Array.from(candidateMap.values());
        const meIdx = candidates.findIndex(c => c.id === me.id);
        if (meIdx >= 0) candidates.splice(meIdx, 1);
        candidates.unshift({
          id: me.id,
          type: 'person',
          name: me.name,
          aliases: me.aliases || ['me', 'i', 'myself'],
          summary: 'The user / author of these memories'
        });

        const { data: periods } = await supabase
          .from('entities')
          .select('id, name, start_date, end_date')
          .eq('user_id', user.id)
          .eq('type', 'period')
          .is('deleted_at', null);

        const currentIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const currentDay = new Date().toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

        const systemPrompt = `You are the knowledge graph extraction and reasoning engine for Virtual Brain (a personal memory and life operating system).
Current Time in IST: ${currentIst} (${currentDay}).

ROOT USER IDENTITY (CRITICAL):
- The author/owner of this brain is: "${me.name}" (ID: "${me.id}", Aliases: ${JSON.stringify(me.aliases || [])}).
- When the memory refers to "I", "me", "my", "myself", or the user states their name/identity, they are ALWAYS the root user.
- NEVER create a separate 'person' entity for the user! Use temp_id='me' for the user.
- If the user states biographical details, attach them as facts to temp_id='me'.

BIOGRAPHICAL ATTRIBUTES ARE FACTS, NEVER ENTITIES (CRITICAL):
The following personal attributes are PROPERTIES of the user. They MUST be extracted as entries in the "facts" array on temp_id='me'. Do NOT create any entity (event, item, period, other, or any type) for them:
- Birthday / date of birth / DOB → fact: key='birth_date', value='YYYY-MM-DD'
- Age → fact: key='age', value='<number>'
- Full name / real name → fact: key='full_name', value='<name>'
- Height → fact: key='height', value='<measurement>'
- Weight → fact: key='weight', value='<measurement>'
- Phone number → fact: key='phone', value='<number>'
- Email → fact: key='email', value='<address>'
- Blood type → fact: key='blood_type', value='<type>'
- Zodiac sign / star sign → fact: key='zodiac_sign', value='<sign>'
- MBTI / personality type → fact: key='mbti', value='<type>'
- Hometown / native place → fact: key='hometown', value='<place>' (but the place itself CAN be an entity if it's a real location)
- Salary / income / CTC → fact: key='salary', value='<amount>'
- Gender / pronouns → fact: key='gender', value='<value>'
Example: "my birthday is 4th october 1999" → entities: [me only], edges: [], facts: [{entity_temp_id: 'me', key: 'birth_date', value: '1999-10-04'}], event_date: '1999-10-04', date_precision: 'day'
Example: "I weigh 62 kg" → entities: [me only], edges: [], facts: [{entity_temp_id: 'me', key: 'weight', value: '62 kg'}]
If the input ONLY contains biographical attributes with no real-world entities, the entities array should contain ONLY the 'me' entity.

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
    "Media & Entertainment" -> category -> "Films & Cinema" (Level 2: Category)
    "Films & Cinema" -> movie -> "Catch Me If You Can" (Level 3: Movie)
    "Media & Entertainment" -> category -> "Gaming" (Level 2: Category)
    "Gaming" -> game -> "Marvel Contest of Champions" (Level 3: Game)
    "Media & Entertainment" -> category -> "Audiobooks & Literature" (Level 2: Category)
    "Audiobooks & Literature" -> platform -> "Audible" (Level 3: Platform)
  * INTERNATIONAL RELOCATION MULTI-TIER TREE:
    'me' -> aiming_for -> "International Relocation" (Level 1: Domain)
    "International Relocation" -> category -> "Target Countries" (Level 2: Category)
    "Target Countries" -> target_country -> "United States", "Canada", "Australia", etc.
  * DATING & RELATIONSHIPS MULTI-TIER TREE:
    'me' -> explores -> "Dating & Relationships" (Level 1: Domain)
    "Dating & Relationships" -> category -> "Dating Platforms" (Level 2: Category)
    "Dating Platforms" -> platform -> "Tinder", "Bumble", "Hinge", "Aisle", "Nymph"
    "Dating & Relationships" -> category -> "Personal Connections" (Level 2: Category)
    "Personal Connections" -> connection -> "Cindy"
  * FOOD & DIETARY MULTI-TIER TREE:
    'me' -> has_preference -> "Food Preferences" (Level 1: Domain)
    "Food Preferences" -> category -> "Favorite Dishes" (Level 2: Category)
    "Favorite Dishes" -> favorite_dish -> "Dosa", "Idli", "Peanut chutney"
    "Food Preferences" -> category -> "Avoided Foods" (Level 2: Category)
    "Avoided Foods" -> avoids -> "Bitter gourd", "Brinjal", "Leafy greens", "Tomato"

4. STRICT ANTI-BYPASS RULE (ZERO SPOKES FROM 'ME' TO LEAF NODES):
- NEVER connect root user 'me' directly to a leaf node (e.g. an app, tool, lens, light, show, movie, food dish, country).
- If the user uses, tries, buys, watches, eats, or likes a leaf entity:
  * The leaf entity connects to its Category (e.g. "Dating Platforms" -> platform -> "Nymph", "Television & Series" -> series -> "How I Met Your Mother").
  * The user's action and status MUST be recorded in FACTS on that leaf entity (e.g. on Nymph: key='status', value='trying', key='started_using', value='2026-01-10').
  * DO NOT add an edge from 'me' to that leaf entity!
- The ONLY entities 'me' connects directly to are:
  1. Top-level Domain Hubs ('Photography', 'Media & Entertainment', 'Dating & Relationships', 'International Relocation', 'Food Preferences', etc.)
  2. First-degree personal anchors: Parents ('family_of'), Primary Employer ('works_at'), Current City ('lives_in'), or major autobiographical life events ('Ooty trip').

4. STATEFUL GRAPH MUTAGENESIS (QUANTITIES & PROGRESSION):
- If the user indicates acquiring *more* of something they already own (e.g., "purchased another Godox lc500r"), DO NOT create a new entity. 
- Look at the entity's \`current_state\` in the Candidates context. If it has \`quantity: X\`, update the entity props to include \`quantity: X+1\` (or \`quantity: 2\` if undefined). 
- If the user says "I now have 3 of these", update props to include \`quantity: 3\`.
- This applies to progression as well (e.g., "finished season 4", update props with \`current_season: 4\`).

5. TEMPORAL EVENT INSTANTIATION (RECURRING EVENTS):
- When the user mentions recurring, cyclical events (e.g., "2024 Birthday", "2025 Birthday", "Christmas 2023", "Our 5th Anniversary"):
  - DO NOT merge all years into one massive abstract "Birthday" node.
  - DO NOT attach specific people to the abstract concept.
  - Instead, create a specific Event Instance (e.g., name: "2025 Birthday", type: "event") and connect it to the abstract Concept (name: "Birthday", type: "event" or "concept") via an edge: "instance_of".
  - Attach the specific participants (a,b,c) and date (2025-10-04) strictly to the Event Instance ("2025 Birthday").

7. MULTI-HOP GRAPH REASONING (LINKING NODES):
- You now have access to \`linked_nodes\` for every candidate entity.
- If a user mentions a concept, DO NOT just look at the node's name. Think based on its linking nodes!
- Example: If the user says "John came over", and there are two Johns, look at their \`linked_nodes\`. If John A is linked to "Software Company" and John B is linked to "Family", pick the right one based on the memory context.

6. Dates & Facts:
- Resolve relative dates against current date and Known Life Periods.
- Extract ALL granular facts (specs, numbers, dates, sentiments, opinions, quotes) into the facts array.`;

        const chunks = chunkText(text, 7000);
        
        const candidateIds = candidates.map(c => c.id);
        const { data: candidateEdges } = await supabase
          .from('edges')
          .select('src, dst, relation')
          .in('src', candidateIds)
          .is('deleted_at', null)
          .limit(100);

        // Build a mapping for fast name lookup
        const idToName = new Map(candidates.map(c => [c.id, c.name]));
        
        // Enrich candidates with their active subgraph connections!
        const enrichedCandidates = candidates.map(c => {
          const relatedEdges = (candidateEdges || [])
            .filter(e => e.src === c.id)
            .map(e => `${e.relation} -> ${idToName.get(e.dst) || 'Unknown Node'}`);
            
          return {
            id: c.id,
            type: c.type,
            name: c.name,
            aliases: c.aliases,
            summary: c.summary,
            current_state: c.props,
            linked_nodes: relatedEdges
          };
        });

        const candidateContext = JSON.stringify(enrichedCandidates, null, 2);
        const periodsContext = JSON.stringify(periods || [], null, 2);

        const extractionPromises = chunks.map(chunk => chatJSON({
          system: systemPrompt,
          prompt: `Raw Memory Entry (Chunk):\n"${chunk}"\n\nCandidate Existing Entities in Graph:\n${candidateContext}\n\nKnown Life Periods:\n${periodsContext}`,
          schema: extractionSchema
        }));

        const allExtractions = await Promise.all(extractionPromises);

        const mergedEntities = new Map<string, any>();
        const tempIdMapping = new Map<string, string>();
        const mergedEdges: any[] = [];
        const mergedFacts: any[] = [];
        const mergedQuestions = new Set<string>();

        let mergedEventDate: string | null = null;
        let mergedDateEnd: string | null = null;
        let mergedDatePrecision: 'day' | 'month' | 'year' | 'period' | 'unknown' = 'unknown';
        let mergedEvent: any = null;

        for (const ex of allExtractions) {
          if (!mergedEventDate && ex.event_date) mergedEventDate = ex.event_date;
          if (!mergedDateEnd && ex.date_end) mergedDateEnd = ex.date_end;
          if (mergedDatePrecision === 'unknown' && ex.date_precision !== 'unknown') {
            mergedDatePrecision = ex.date_precision;
          }
          if (!mergedEvent && ex.event) mergedEvent = ex.event;

          for (const ent of ex.entities) {
            if (ent.temp_id === 'me') {
              if (!mergedEntities.has('me')) {
                mergedEntities.set('me', ent);
              } else {
                const existing = mergedEntities.get('me');
                existing.props = { ...existing.props, ...ent.props };
                if (ent.summary && !existing.summary) existing.summary = ent.summary;
              }
              tempIdMapping.set('me', 'me');
              continue;
            }

            const normName = ent.name.toLowerCase().trim();
            const entAliases = (ent.aliases || []).map((a: string) => a.toLowerCase().trim());

            let matchedKey: string | null = null;
            for (const [key, existing] of mergedEntities.entries()) {
              if (key === 'me') continue;
              
              const existingNormName = existing.name?.toLowerCase().trim() || key;
              const existingAliases = (existing.aliases || []).map((a: string) => a.toLowerCase().trim());

              // 1. Exact normalized name or alias match
              if (
                key === normName ||
                existingAliases.includes(normName) ||
                entAliases.includes(key) ||
                entAliases.includes(existingNormName) ||
                entAliases.some((a: string) => existingAliases.includes(a))
              ) {
                matchedKey = key;
                break;
              }

              // 2. Fuzzy string similarity (catches 'birth-day' ≈ 'birthday', 'Interstellar Movie' ≈ 'Interstellar')
              // Use a lower threshold (0.80) since these are entities from the SAME input text
              const sim = stringSimilarity(ent.name, existing.name || key);
              if (sim >= 0.80 && (!ent.type || !existing.type || ent.type === existing.type)) {
                matchedKey = key;
                break;
              }

              // 3. Fuzzy match new name against existing aliases
              for (const alias of existingAliases) {
                if (alias.length > 2 && stringSimilarity(normName, alias) >= 0.82) {
                  matchedKey = key;
                  break;
                }
              }
              if (matchedKey) break;
            }

            if (matchedKey) {
              const existing = mergedEntities.get(matchedKey);
              tempIdMapping.set(ent.temp_id, existing.temp_id);
              existing.aliases = Array.from(new Set([...(existing.aliases || []), ...(ent.aliases || []), ent.name]));
              existing.props = { ...existing.props, ...ent.props };
              if (ent.summary && !existing.summary) existing.summary = ent.summary;
              if (ent.match?.existing_id && !existing.match?.existing_id) existing.match = ent.match;
            } else {
              mergedEntities.set(normName, ent);
              tempIdMapping.set(ent.temp_id, ent.temp_id);
            }
          }
        }

        for (const ex of allExtractions) {
          for (const edge of ex.edges) {
            mergedEdges.push({
              ...edge,
              src_temp_id: tempIdMapping.get(edge.src_temp_id) || edge.src_temp_id,
              dst_temp_id: tempIdMapping.get(edge.dst_temp_id) || edge.dst_temp_id,
            });
          }
          for (const fact of ex.facts) {
            mergedFacts.push({
              ...fact,
              entity_temp_id: tempIdMapping.get(fact.entity_temp_id) || fact.entity_temp_id,
            });
          }
          for (const q of ex.questions) {
            mergedQuestions.add(q);
          }
        }

        const uniqueEdges = [];
        const edgeSeen = new Set();
        for (const e of mergedEdges) {
          const key = `${e.src_temp_id}-${e.dst_temp_id}-${e.relation}`;
          if (!edgeSeen.has(key)) {
            edgeSeen.add(key);
            uniqueEdges.push(e);
          }
        }

        const uniqueFacts = [];
        const factSeen = new Set();
        for (const f of mergedFacts) {
          const key = `${f.entity_temp_id}-${f.key}-${f.value}`;
          if (!factSeen.has(key)) {
            factSeen.add(key);
            uniqueFacts.push(f);
          }
        }

        const { restructureHierarchicalExtraction } = await import('@/lib/graph-hierarchy');
        const hierarchicalResult = await restructureHierarchicalExtraction(
          Array.from(mergedEntities.values()),
          uniqueEdges,
          uniqueFacts,
          candidates
        );

        const finalExtraction = {
          event_date: mergedEventDate,
          date_end: mergedDateEnd,
          date_precision: mergedDatePrecision,
          entities: hierarchicalResult.entities,
          edges: hierarchicalResult.edges,
          facts: hierarchicalResult.facts,
          event: mergedEvent,
          questions: Array.from(mergedQuestions)
        };

        const newStatus = finalExtraction.questions.length > 0 ? 'draft' : 'ready';

        if (isAsync) {
          // In async mode, update the entry status and cache the extraction
          await supabase.from('entries').update({
            status: newStatus
          }).eq('id', entry.id);

          extractionCache.set(entry.id, {
            status: newStatus,
            extraction: finalExtraction,
            candidates
          });
        }

        return { finalExtraction, candidates, newStatus };
      } catch (err) {
        console.error('Background extraction error:', err);
        if (isAsync) {
          await supabase.from('entries').update({
            status: 'draft'
          }).eq('id', entry.id);

          extractionCache.set(entry.id, {
            status: 'error',
            error: String(err)
          });
        }
        throw err;
      }
    };

    if (isAsync) {
      // Fire and forget
      after(async () => {
        await extractionTask().catch(e => console.error('Unhandled async extraction error:', e));
      });
      return NextResponse.json({
        entry_id: entry.id,
        status: 'extracting',
        message: 'Memory extraction underway in neural background'
      }, { status: 202 });
    } else {
      // Sync execution
      const { finalExtraction, candidates } = await extractionTask();
      return NextResponse.json({
        entry_id: entry.id,
        extraction: finalExtraction,
        candidates
      });
    }
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
