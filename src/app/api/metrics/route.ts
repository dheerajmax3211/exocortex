import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMetricsSummary } from '@/lib/server/metrics';

export async function GET(request: Request) {
  // Simple auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // If there's no auth header, or it doesn't match cron secret, we might also want to allow authenticated users via session.
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = await createClient();
  
  // Get counts
  const { count: entityCount } = await supabase.from('entities').select('*', { count: 'exact', head: true });
  const { count: edgeCount } = await supabase.from('edges').select('*', { count: 'exact', head: true });
  const { count: factCount } = await supabase.from('facts').select('*', { count: 'exact', head: true });
  const { count: entryCount } = await supabase.from('entries').select('*', { count: 'exact', head: true });

  const { data: lastEntry } = await supabase
    .from('entries')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const metrics = getMetricsSummary();

  return NextResponse.json({
    metrics,
    graph: {
      entity_count: entityCount || 0,
      edge_count: edgeCount || 0,
      fact_count: factCount || 0,
      entry_count: entryCount || 0,
    },
    system: {
      uptime: process.uptime(),
      last_extraction: lastEntry?.created_at || null,
      migrations_applied: ['001', '002', '003'] // Hardcoded for now based on instructions
    }
  });
}
