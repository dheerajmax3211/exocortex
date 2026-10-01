import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const entryId = resolvedParams.id;
    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    // 1. Check in-memory extraction cache first
    const cache = (globalThis as any).__extractionCache;
    const cached = cache?.get(entryId);
    if (cached) {
      return NextResponse.json({
        status: cached.status,
        extraction: cached.extraction || null,
        candidates: cached.candidates || null,
        error: cached.error || null
      });
    }

    // 2. Query entries table without selecting non-existent props
    const { data: entry, error } = await supabase
      .from('entries')
      .select('id, status')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    if (entry.status === 'extracting') {
      return NextResponse.json({ status: 'extracting', message: 'Memory extraction underway in neural background' });
    }

    return NextResponse.json({ status: entry.status });
  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
