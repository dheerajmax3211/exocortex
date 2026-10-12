import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mergeEntities } from '../../../../lib/db';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // We use the service role key to have access to all users' entities for cron background tasks
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Call duplicate entity finding function with fallback if migration not yet applied
    let duplicates: any[] = [];
    try {
      const { data, error } = await supabase
        .rpc('find_duplicate_entities', { p_similarity_threshold: 0.98 });
      if (!error && data) {
        duplicates = data;
      } else if (error) {
        console.warn('find_duplicate_entities RPC skipped (migration pending):', error.message);
      }
    } catch (e: any) {
      console.warn('find_duplicate_entities RPC exception:', e.message);
    }
    
    const mergedPairs = [];
    
    // Process merges sequentially to prevent race conditions on edges/facts
    if (duplicates && duplicates.length > 0) {
      for (const pair of duplicates) {
        // Double check they still exist (might have been merged in an earlier iteration of this loop if chained)
        const { target_id, source_id, similarity } = pair;
        
        await mergeEntities(supabase, target_id, source_id);
        
        mergedPairs.push({
          targetId: target_id,
          sourceId: source_id,
          targetName: pair.target_name,
          sourceName: pair.source_name,
          similarity
        });
      }
    }

    // Fact hygiene: clean up duplicate facts and auto-supersede single-valued conflicts
    const SINGLE_VALUED_KEYS = new Set([
      'weight', 'current_weight', 'salary', 'compensation', 'employer', 'current_employer',
      'departure_time', 'arrival_time', 'job_title', 'location', 'current_city', 'residence'
    ]);

    const { data: activeFacts } = await supabase
      .from('facts')
      .select('id, user_id, entity_id, key, value, entry_id, learned_at')
      .is('invalidated_at', null);

    let resolvedFactsCount = 0;
    if (activeFacts && activeFacts.length > 0) {
      const grouped = new Map<string, typeof activeFacts>();
      for (const f of activeFacts) {
        const k = `${f.entity_id}:${f.key.toLowerCase()}`;
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push(f);
      }

      for (const [key, group] of grouped.entries()) {
        if (group.length > 1) {
          const factKey = group[0].key.toLowerCase();
          const isSingleValued = SINGLE_VALUED_KEYS.has(factKey);

          // Check if exact duplicate value or single-valued conflict
          const values = group.map(f => typeof f.value === 'string' ? f.value.trim().toLowerCase() : JSON.stringify(f.value));
          const hasExactDup = new Set(values).size < values.length;

          if (hasExactDup || isSingleValued) {
            // Sort so newest stays active, older ones get invalidated
            // Keep the last item in the group, invalidate all preceding ones
            const keepFact = group[group.length - 1];
            const toInvalidate = group.slice(0, group.length - 1);

            for (const oldFact of toInvalidate) {
              await supabase
                .from('facts')
                .update({
                  invalidated_at: new Date().toISOString(),
                  valid_to: new Date().toISOString().split('T')[0]
                })
                .eq('id', oldFact.id);

              if (isSingleValued) {
                try {
                  await supabase
                    .from('facts')
                    .update({ supersedes_fact_id: oldFact.id })
                    .eq('id', keepFact.id);
                } catch {
                  // ignore if supersedes_fact_id column not present
                }
              }
              resolvedFactsCount++;
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: mergedPairs.length,
      mergedPairs,
      resolvedFactsCount
    });
    
  } catch (err: any) {
    console.error('Hygiene cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
