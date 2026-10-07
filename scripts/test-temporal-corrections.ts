import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { randomUUID } from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_URL = 'http://localhost:3000';

async function checkServer() {
  try {
    await fetch(`${API_URL}/api/health`, { method: 'GET' }).catch(() => fetch(`${API_URL}/`, { method: 'GET' }));
    return true;
  } catch (e) {
    return false;
  }
}

async function runTests() {
  const isUp = await checkServer();
  if (!isUp) {
    console.error('❌ Dev server is not running on http://localhost:3000. Please start it using `npm run dev` before running this test.');
    process.exit(1);
  }

  const email = `test-${Date.now()}@example.com`;
  const password = 'testpassword123';
  
  console.log('Creating test user...');
  const { data: userRecord, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (userError) throw userError;
  const userId = userRecord.user.id;
  
  const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password
  });
  if (authError) throw authError;
  
  const token = authData.session!.access_token;
  
  let passed = 0;
  let failed = 0;
  
  const assertEq = (desc: string, actual: any, expected: any) => {
    if (actual === expected) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc} | Expected: ${expected}, Actual: ${actual}`);
      failed++;
    }
  };
  const assertNotNull = (desc: string, actual: any) => {
    if (actual !== null && actual !== undefined) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc} | Expected Not Null, Actual: ${actual}`);
      failed++;
    }
  };

  const apiFetch = async (path: string, body: any) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  };

  try {
    console.log('\n--- Scenario 1: Basic fact supersession ---');
    console.log('Ingesting Memory 1...');
    const mem1 = await apiFetch('/api/ingest', { text: 'I weigh 65 kg' });
    assertNotNull('Memory 1 extraction returned', mem1.extraction);
    await apiFetch('/api/ingest/commit', {
      entry_id: mem1.entry_id,
      ...mem1.extraction,
      candidate_ids: mem1.candidates.map((c: any) => c.id)
    });
    console.log('Ingesting Memory 2...');
    const mem2 = await apiFetch('/api/ingest', { text: 'I now weigh 62 kg' });
    const meFacts = mem2.extraction.facts.filter((f: any) => f.entity_temp_id === 'me' || f.entity_temp_id === mem2.candidates[0]?.id);
    const weightFact = meFacts.find((f: any) => f.key === 'weight');
    assertEq('Memory 2 extracts new weight', weightFact?.value, '62 kg');
    assertNotNull('Memory 2 includes supersedes_fact_id', weightFact?.supersedes_fact_id);
    await apiFetch('/api/ingest/commit', {
      entry_id: mem2.entry_id,
      ...mem2.extraction,
      candidate_ids: mem2.candidates.map((c: any) => c.id)
    });

    console.log('\n--- Scenario 2: Pending-to-completed temporal progression ---');
    const bday1 = await apiFetch('/api/ingest', { text: 'Teju has not wished me at midnight for my birthday' });
    await apiFetch('/api/ingest/commit', {
      entry_id: bday1.entry_id,
      ...bday1.extraction,
      candidate_ids: bday1.candidates.map((c: any) => c.id)
    });
    const bday2 = await apiFetch('/api/ingest', { text: 'Teju wished me later at 9am' });
    await apiFetch('/api/ingest/commit', {
      entry_id: bday2.entry_id,
      ...bday2.extraction,
      candidate_ids: bday2.candidates.map((c: any) => c.id)
    });
    console.log('Asking question...');
    const askRes = await apiFetch('/api/ask', { query: 'Did Teju wish me?' });
    console.log(`Answer: ${askRes.answer}`);
    if (askRes.answer.toLowerCase().includes('yes') || askRes.answer.toLowerCase().includes('wished')) {
      console.log('✅ PASS: Answer correctly reflects the later correction');
      passed++;
    } else {
      console.error('❌ FAIL: Answer did not reflect correction');
      failed++;
    }

    console.log('\n--- Scenario 3: Date precision handling ---');
    const dYear = await apiFetch('/api/ingest', { text: 'In 2015 I visited London' });
    assertEq('Year precision', dYear.extraction.date_precision, 'year');
    const dDay = await apiFetch('/api/ingest', { text: 'On March 15, 2023 I had dinner at Taj' });
    assertEq('Day precision', dDay.extraction.date_precision, 'day');
    const dMonth = await apiFetch('/api/ingest', { text: 'Last month I started yoga' });
    assertEq('Month precision', dMonth.extraction.date_precision, 'month');

    console.log('\n--- Scenario 4: Approximate vs exact time ---');
    const approx = await apiFetch('/api/ingest', { text: 'I had coffee around 3pm' });
    assertEq('Approximate precision', approx.extraction.event_time_precision, 'approximate');
    assertEq('Approximate time null', approx.extraction.event_time, null);
    
    const exact = await apiFetch('/api/ingest', { text: 'Meeting at exactly 2:30 PM' });
    assertEq('Exact precision', exact.extraction.event_time_precision, 'exact');
    assertNotNull('Exact time recorded', exact.extraction.event_time);

    console.log('\n--- Scenario 5: Timezone boundary ---');
    const tzBoundary = await apiFetch('/api/ingest', { text: 'At 11:45 PM on Dec 31 we celebrated New Year' });
    const hasDec31 = tzBoundary.extraction.event_date?.includes('-12-31') || 
                     tzBoundary.extraction.facts.some((f: any) => f.valid_from?.includes('-12-31') || f.valid_time_start?.includes('-12-31'));
    if (hasDec31) {
      console.log('✅ PASS: Timezone boundary respected (Dec 31)');
      passed++;
    } else {
      console.error('❌ FAIL: Timezone boundary incorrect');
      failed++;
    }

    console.log('\n--- Scenario 6: Same entity different facts ---');
    const rahul1 = await apiFetch('/api/ingest', { text: 'Rahul works at Google' });
    await apiFetch('/api/ingest/commit', { entry_id: rahul1.entry_id, ...rahul1.extraction, candidate_ids: rahul1.candidates.map((c: any) => c.id) });
    const rahul2 = await apiFetch('/api/ingest', { text: 'Rahul moved to Microsoft' });
    await apiFetch('/api/ingest/commit', { entry_id: rahul2.entry_id, ...rahul2.extraction, candidate_ids: rahul2.candidates.map((c: any) => c.id) });
    const rahul3 = await apiFetch('/api/ingest', { text: 'Rahul likes cricket' });
    await apiFetch('/api/ingest/commit', { entry_id: rahul3.entry_id, ...rahul3.extraction, candidate_ids: rahul3.candidates.map((c: any) => c.id) });
    
    // Audit db to see active facts for Rahul
    const { data: rahulFacts } = await supabaseAdmin.from('facts')
      .select('*')
      .eq('user_id', userId)
      .is('invalidated_at', null);
    const eFacts = rahulFacts?.filter(f => f.key === 'employer' || f.key === 'likes') || [];
    const hasMicrosoft = eFacts.some(f => f.value === 'Microsoft');
    const hasGoogle = eFacts.some(f => f.value === 'Google');
    const hasCricket = eFacts.some(f => f.value === 'cricket');
    assertEq('Microsoft is active', hasMicrosoft, true);
    assertEq('Google is inactive', hasGoogle, false);
    assertEq('Cricket is active', hasCricket, true);

    console.log('\n--- Scenario 7: Retry after partial failure ---');
    // Simulate partial failure by ingesting and committing an entry, then doing it again with same entry ID
    const retryText = 'I bought a new car';
    const retry1 = await apiFetch('/api/ingest', { text: retryText });
    await apiFetch('/api/ingest/commit', { entry_id: retry1.entry_id, ...retry1.extraction, candidate_ids: retry1.candidates.map((c: any) => c.id) });
    // Retry with same entry ID via commit
    const retryCommit2 = await fetch(`${API_URL}/api/ingest/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ entry_id: retry1.entry_id, ...retry1.extraction, candidate_ids: retry1.candidates.map((c: any) => c.id) })
    });
    const retryRes = await retryCommit2.json();
    assertEq('Retry returns already_committed', retryRes.already_committed, true);
    
    const { data: carFacts } = await supabaseAdmin.from('facts')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_id', retry1.entry_id);
    // Even if it was executed twice, we shouldn't have duplicate facts per entry
    const uniqueKeys = new Set(carFacts?.map(f => f.key));
    if (carFacts && carFacts.length === uniqueKeys.size && carFacts.length > 0) {
      console.log('✅ PASS: No duplicate facts on retry');
      passed++;
    } else {
      console.error(`❌ FAIL: Duplicate facts detected or no facts created. Count: ${carFacts?.length}`);
      failed++;
    }

    console.log(`\nTests completed: ${passed} passed, ${failed} failed`);
    
  } finally {
    console.log('Cleaning up test data...');
    await supabaseAdmin.auth.admin.deleteUser(userId);
  }
}

runTests().catch(e => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
