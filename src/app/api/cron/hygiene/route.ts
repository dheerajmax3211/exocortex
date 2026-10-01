import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mergeEntities } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // We use the service role key to have access to all users' entities for cron background tasks
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Call our duplicate finding function
    const { data: duplicates, error } = await supabase
      .rpc('find_duplicate_entities', { p_similarity_threshold: 0.98 });
      
    if (error) {
      console.error('Error finding duplicates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    
    return NextResponse.json({
      success: true,
      processed: mergedPairs.length,
      mergedPairs
    });
    
  } catch (err: any) {
    console.error('Hygiene cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
