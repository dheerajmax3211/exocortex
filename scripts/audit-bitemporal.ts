import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runAudit() {
  console.log('🔍 Starting Bitemporal Semantics Audit...\n');

  // We fetch all facts. In a huge DB this would be paginated.
  const { data: facts, error } = await supabase.from('facts').select('*');
  if (error) {
    console.error('Failed to fetch facts:', error);
    process.exit(1);
  }

  if (!facts || facts.length === 0) {
    console.log('No facts found to audit.');
    return;
  }

  console.log(`Auditing ${facts.length} total facts...\n`);

  const issues: string[] = [];

  // 1. Facts with exact timestamps but approximate precision
  const exactButApprox = facts.filter(f => 
    f.valid_time_start !== null && 
    (f.valid_time_precision === 'approximate' || f.valid_time_precision === 'date_only')
  );
  if (exactButApprox.length > 0) {
    issues.push(`⚠️ Found ${exactButApprox.length} facts with exact timestamps but approximate/date_only precision:`);
    exactButApprox.forEach(f => issues.push(`  - Fact ID: ${f.id} (Entity: ${f.entity_id}, Key: ${f.key})`));
  } else {
    console.log('✅ No conflicting precision/timestamp mismatches.');
  }

  // 2. Duplicate active facts for same entity+key
  const activeFacts = facts.filter(f => f.invalidated_at === null);
  const activeMap = new Map<string, string[]>();
  activeFacts.forEach(f => {
    const k = `${f.entity_id}:${f.key}`;
    if (!activeMap.has(k)) activeMap.set(k, []);
    activeMap.get(k)!.push(f.id);
  });
  
  let duplicateCount = 0;
  for (const [key, factIds] of activeMap.entries()) {
    if (factIds.length > 1) {
      duplicateCount++;
      issues.push(`⚠️ Found ${factIds.length} active duplicate facts for Entity:Key [${key}] -> IDs: ${factIds.join(', ')}`);
    }
  }
  if (duplicateCount === 0) {
    console.log('✅ No duplicate active facts for the same entity+key.');
  }

  // 3. Superseded facts (invalidated_at != null) but no active fact pointing to them via supersedes_fact_id
  const supersededFacts = facts.filter(f => f.invalidated_at !== null);
  const factsWithSupersedesLink = facts.filter(f => f.supersedes_fact_id !== null);
  const validSupersedesLinks = new Set(factsWithSupersedesLink.map(f => f.supersedes_fact_id));

  let brokenSupersedes = 0;
  supersededFacts.forEach(f => {
    if (!validSupersedesLinks.has(f.id)) {
      brokenSupersedes++;
      issues.push(`⚠️ Fact ID ${f.id} is superseded (invalidated_at set) but no new fact links back to it via supersedes_fact_id.`);
    }
  });
  if (brokenSupersedes === 0) {
    console.log('✅ All superseded facts have valid linked successors.');
  }

  // 4. Facts with valid_from but no valid_to (This is perfectly valid for ongoing states, but instructions requested reporting it)
  const openEnded = facts.filter(f => f.valid_from !== null && f.valid_to === null && f.invalidated_at !== null);
  // Wait, if it's invalidated it SHOULD have a valid_to. If it's active, valid_to is naturally null.
  // We'll report invalidated facts with missing valid_to
  let missingValidTo = 0;
  supersededFacts.forEach(f => {
    if (f.valid_from !== null && f.valid_to === null) {
      missingValidTo++;
      issues.push(`⚠️ Fact ID ${f.id} was invalidated but its valid_to date was never closed.`);
    }
  });
  if (missingValidTo === 0) {
    console.log('✅ All invalidated temporal facts have a closed valid_to bound.');
  }

  if (issues.length > 0) {
    console.log('\n--- AUDIT ISSUES DETECTED ---');
    issues.forEach(i => console.log(i));
  } else {
    console.log('\n🌟 Audit passed cleanly!');
  }
}

runAudit().catch(e => {
  console.error('Audit failed:', e);
  process.exit(1);
});
