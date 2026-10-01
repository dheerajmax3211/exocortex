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

    let data;
    let count = 0;

    if (search && search.length > 0) {
      // Use our powerful new Hybrid Search RPC (pgvector + trigram + alias match)
      const { data: searchResults, error: searchError } = await supabase.rpc('search_entities', {
        p_query: search,
        p_user_id: user.id
      });

      if (searchError) throw searchError;

      // Filter by type manually if requested since RPC doesn't do it natively yet
      let filtered = searchResults || [];
      if (type) {
        filtered = filtered.filter((e: any) => e.type === type);
      }
      count = filtered.length;
      data = filtered.slice(offset, offset + limit);
    } else {
      // Standard query
      let query = supabase
        .from('entities')
        .select('id, name, type, summary', { count: 'exact' })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (type) {
        query = query.eq('type', type);
      }

      query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

      const { data: qData, count: qCount, error: qError } = await query;
      if (qError) throw qError;
      
      data = qData;
      count = qCount || 0;
    }

    return NextResponse.json({
      data: data || [],
      entities: data || [],
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
