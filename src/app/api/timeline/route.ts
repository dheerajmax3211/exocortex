import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('entries')
      .select(`
        id, raw_text, event_date, status, created_at,
        entry_entities (
          entity:entities ( id, name, type )
        )
      `, { count: 'exact' })
      .eq('user_id', user.id);

    if (date) {
      query = query.lte('event_date', date);
    }

    query = query.order('event_date', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data,
      meta: {
        total: count,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
