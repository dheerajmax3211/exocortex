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
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    const offset = (page - 1) * limit;

    let query = supabase
      .from('entities')
      .select('id, name, type, summary', { count: 'exact' })
      .eq('user_id', user.id);

    if (type) {
      query = query.eq('type', type);
    }

    if (search) {
      // Basic ilike or trigram if extension loaded
      query = query.ilike('name', `%${search}%`);
    }

    query = query.range(offset, offset + limit - 1).order('updated_at', { ascending: false });

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
