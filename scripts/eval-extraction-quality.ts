import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VALID_ENTITY_TYPES = new Set([
  'person', 'place', 'restaurant', 'dish', 'movie', 'show', 
  'book', 'school', 'org', 'period', 'event', 'item', 'other'
]);

async function runEval() {
  console.log("Starting Extraction Quality Eval...");
  
  // Fetch last 50 committed entries
  const { data: entries, error } = await supabase
    .from('entries')
    .select('*')
    .eq('status', 'committed')
    .order('entered_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching entries:", error);
    return;
  }

  let totalEntries = 0;
  let hasEntities = 0;
  let hasMeLinked = 0;
  let validEntityTypes = 0;
  let validEdges = 0;
  let validFacts = 0;
  let validDates = 0;

  for (const entry of entries) {
    totalEntries++;
    
    // Fetch related data
    const { data: entryEntities } = await supabase
      .from('entry_entities')
      .select('entity_id')
      .eq('entry_id', entry.id);
      
    const entityIds = (entryEntities || []).map(ee => ee.entity_id);
    
    if (entityIds.length > 0) {
      hasEntities++;
    }

    const { data: entities } = await supabase
      .from('entities')
      .select('*')
      .in('id', entityIds);

    let meFound = false;
    let allTypesValid = true;
    
    for (const ent of (entities || [])) {
      if (ent.name.toLowerCase() === 'me' || ent.aliases?.map((a: string) => a.toLowerCase()).includes('me')) {
        meFound = true;
      }
      if (!VALID_ENTITY_TYPES.has(ent.type)) {
        allTypesValid = false;
      }
    }
    
    if (meFound) hasMeLinked++;
    if (allTypesValid) validEntityTypes++;

    const { data: edges } = await supabase
      .from('edges')
      .select('*')
      .eq('entry_id', entry.id);

    let edgesValid = true;
    for (const edge of (edges || [])) {
      if (!entityIds.includes(edge.src) || !entityIds.includes(edge.dst)) {
        // Technically edge could link to entities not in entryEntities? Usually it links entry entities.
        edgesValid = false;
      }
    }
    if (edgesValid) validEdges++;

    const { data: facts } = await supabase
      .from('facts')
      .select('*')
      .eq('entry_id', entry.id);

    let factsValid = true;
    for (const fact of (facts || [])) {
      if (!entityIds.includes(fact.entity_id)) {
        factsValid = false;
      }
    }
    if (factsValid) validFacts++;

    let datesValid = true;
    const checkDate = (d: string | null | undefined) => {
      if (!d) return true;
      const year = new Date(d).getFullYear();
      if (year < 1900 || year > new Date().getFullYear() + 10) return false;
      return true;
    };
    
    if (!checkDate(entry.event_date) || !checkDate(entry.date_end)) {
      datesValid = false;
    }
    if (datesValid) validDates++;
  }

  console.log("=== Extraction Quality Report ===");
  console.log(`Total Entries Evaluated: ${totalEntries}`);
  console.log(`Has Entities: ${hasEntities} / ${totalEntries}`);
  console.log(`Has 'me' Entity Linked: ${hasMeLinked} / ${totalEntries}`);
  console.log(`Valid Entity Types: ${validEntityTypes} / ${totalEntries}`);
  console.log(`Valid Edge References: ${validEdges} / ${totalEntries}`);
  console.log(`Valid Fact References: ${validFacts} / ${totalEntries}`);
  console.log(`Reasonable Dates: ${validDates} / ${totalEntries}`);
}

runEval().catch(console.error);
