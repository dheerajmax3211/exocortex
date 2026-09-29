import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { primaryId, secondaryId } = await req.json();

    if (!primaryId || !secondaryId || primaryId === secondaryId) {
      return NextResponse.json({ error: 'Valid primaryId and secondaryId are required' }, { status: 400 });
    }

    // Call db.mergeEntities (repoints edges, facts, entry_entities, unions aliases, and soft deletes secondary)
    await db.mergeEntities(supabase, primaryId, secondaryId);

    // Delete merged-away entity from graph_layout
    await db.deleteLayout(supabase, secondaryId);

    return NextResponse.json({
      success: true,
      primaryId,
      mergedAwayId: secondaryId,
      message: 'Entities successfully merged and graph layout updated.'
    });
  } catch (error: any) {
    console.error('Merge error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
