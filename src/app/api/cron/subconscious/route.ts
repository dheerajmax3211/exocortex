import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { generateProactiveBriefing } from '@/lib/proactive-briefing';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const { searchParams } = new URL(req.url);
    const userIdFromQuery = searchParams.get('user_id');

    let userId = userIdFromQuery;
    let isAdmin = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAdmin = true;
    } else {
      // Check normal auth
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Can only act on self if not admin
      if (userId && userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required for cron execution' }, { status: 400 });
    }

    // Use admin client for cron, or normal client for user
    const supabaseToUse = isAdmin ? createAdminClient() : await createClient();

    const { state, briefing } = await generateProactiveBriefing(supabaseToUse, userId);

    return NextResponse.json({
      success: true,
      briefing,
      vectors: state.vectors,
      tensions: state.tensions
    });
  } catch (error: any) {
    console.error('Proactive briefing error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
