import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entity = await db.getEntity(supabase, id);
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const facts = await db.getFactsForEntity(supabase, id);
    const edges = await db.getEdgesForEntity(supabase, id);
    const entries = await db.getEntriesForEntity(supabase, id);

    return NextResponse.json({
      entity,
      facts: facts || [],
      edges: edges || [],
      entries: entries || []
    });
  } catch (error: any) {
    console.error('Entity GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await req.json();
    const updated = await db.updateEntity(supabase, id, updates);

    return NextResponse.json({ success: true, entity: updated });
  } catch (error: any) {
    console.error('Entity PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.softDeleteEntity(supabase, id);
    await db.deleteLayout(supabase, id);

    return NextResponse.json({ success: true, id, deleted: true });
  } catch (error: any) {
    console.error('Entity DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
