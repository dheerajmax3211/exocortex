import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }



    const { data: entity, error } = await supabase
      .from('entities')
      .select('id, name, type, summary')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Fetch one grounded fact depending on type (simplification)
    const { data: facts } = await supabase
      .from('facts')
      .select('key, value')
      .eq('entity_id', id)
      .eq('user_id', user.id)
      .limit(1);

    return NextResponse.json({
      entity,
      topFact: facts?.[0] || null
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
