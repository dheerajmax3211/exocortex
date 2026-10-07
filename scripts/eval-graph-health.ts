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

async function runEval() {
  console.log("Starting Graph Health Eval...");

  const { data: entities } = await supabase.from('entities').select('*').is('deleted_at', null);
  const { data: edges } = await supabase.from('edges').select('*').is('deleted_at', null);
  const { data: facts } = await supabase.from('facts').select('*');

  if (!entities || !edges || !facts) {
    console.error("Could not fetch graph data.");
    return;
  }

  const numEntities = entities.length;
  const numEdges = edges.length;
  
  // Entity type distribution
  const typeDist: Record<string, number> = {};
  entities.forEach(e => {
    typeDist[e.type] = (typeDist[e.type] || 0) + 1;
  });

  // Fact key distribution
  const factDist: Record<string, number> = {};
  facts.forEach(f => {
    factDist[f.key] = (factDist[f.key] || 0) + 1;
  });

  // Edge relation distribution
  const relDist: Record<string, number> = {};
  edges.forEach(e => {
    relDist[e.relation] = (relDist[e.relation] || 0) + 1;
  });

  // Orphan entities
  const linkedEntities = new Set<string>();
  edges.forEach(e => {
    linkedEntities.add(e.src);
    linkedEntities.add(e.dst);
  });
  
  let orphans = 0;
  entities.forEach(e => {
    if (!linkedEntities.has(e.id)) {
      orphans++;
    }
  });

  // Entities with no facts
  const entitiesWithFacts = new Set<string>();
  facts.forEach(f => {
    entitiesWithFacts.add(f.entity_id);
  });
  
  let noFacts = 0;
  entities.forEach(e => {
    if (!entitiesWithFacts.has(e.id)) {
      noFacts++;
    }
  });

  // Duplicate names
  const nameCount: Record<string, number> = {};
  entities.forEach(e => {
    const name = e.name.toLowerCase();
    nameCount[name] = (nameCount[name] || 0) + 1;
  });
  let duplicateNames = 0;
  Object.values(nameCount).forEach(c => {
    if (c > 1) duplicateNames++;
  });

  console.log("=== Graph Health Report ===");
  console.log(`Total Entities: ${numEntities}`);
  console.log(`Total Edges: ${numEdges}`);
  console.log(`Average Edges per Entity: ${(numEdges / (numEntities || 1)).toFixed(2)}`);
  console.log(`Orphan Entities: ${orphans} / ${numEntities}`);
  console.log(`Entities with NO Facts: ${noFacts} / ${numEntities}`);
  console.log(`Entities with Duplicate Names: ${duplicateNames}`);
  
  console.log("\n--- Entity Type Distribution ---");
  Object.entries(typeDist).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`${k}: ${v}`));

  console.log("\n--- Top 10 Fact Keys ---");
  Object.entries(factDist).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([k,v]) => console.log(`${k}: ${v}`));

  console.log("\n--- Top 10 Edge Relations ---");
  Object.entries(relDist).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([k,v]) => console.log(`${k}: ${v}`));
}

runEval().catch(console.error);
