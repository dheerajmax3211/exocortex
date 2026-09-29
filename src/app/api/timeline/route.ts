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
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('entries')
      .select(`
        id, raw_text, event_date, status, entered_at,
        entry_entities (
          entity:entities ( id, name, type )
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .eq('status', 'committed');

    if (date) {
      query = query.lte('event_date', date);
    }

    if (search) {
      query = query.ilike('raw_text', `%${search}%`);
    }

    query = query.order('event_date', { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    // Group entries by date for the timeline UI
    const entriesByDate: Record<string, any[]> = {};
    for (const item of data || []) {
      const dateKey = item.event_date || (item.entered_at ? new Date(item.entered_at).toISOString().split('T')[0] : 'Undated');
      if (!entriesByDate[dateKey]) {
        entriesByDate[dateKey] = [];
      }
      entriesByDate[dateKey].push({
        id: item.id,
        raw_text: item.raw_text,
        text_content: item.raw_text,
        event_date: item.event_date,
        entered_at: item.entered_at,
        created_at: item.entered_at,
        entities: (item.entry_entities || []).map((ee: any) => ee.entity).filter(Boolean)
      });
    }

    return NextResponse.json({
      data: data || [],
      entriesByDate,
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
