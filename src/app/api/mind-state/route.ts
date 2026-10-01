import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrRefreshMindState, runSubconsciousSynthesis } from '@/lib/subconscious-engine';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get('refresh') === 'true';

    const mindState = await getOrRefreshMindState(supabase, user.id, refresh);
    return NextResponse.json(mindState);
  } catch (error: any) {
    console.error('Mind state error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const freshState = await runSubconsciousSynthesis(supabase, user.id);
    return NextResponse.json(freshState);
  } catch (error: any) {
    console.error('Force synthesis error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
