import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: entity, error } = await supabase
      .from('entities')
      .select('id, name, type, summary, props, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    let factLine: string | null = null;

    // 1. Check for specific high-signal edges
    if (entity.type === 'restaurant') {
      // Find top rated dish served
      const { data: dishEdges } = await supabase
        .from('edges')
        .select('relation, props, dst:entities!edges_dst_fkey(name)')
        .eq('src', id)
        .in('relation', ['served', 'tries', 'tried'])
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .limit(5);

      if (dishEdges && dishEdges.length > 0) {
        // Sort by rating_10 if available
        const rated = dishEdges.find((e: any) => e.props?.rating_10);
        if (rated) {
          const dishName = (rated.dst as any)?.name || 'Dish';
          factLine = `Top dish: ${dishName} (${rated.props.rating_10}/10)`;
        } else if (dishEdges[0].dst) {
          factLine = `Known for: ${(dishEdges[0].dst as any)?.name}`;
        }
      }
    } else if (entity.type === 'person') {
      // Find relation like taught or classmate_of
      const { data: relations } = await supabase
        .from('edges')
        .select('relation, props, occurred_on, dst:entities!edges_dst_fkey(name)')
        .or(`src.eq.${id},dst.eq.${id}`)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .limit(3);

      if (relations && relations.length > 0) {
        const rel = relations[0];
        if (rel.relation === 'taught' && rel.props?.subject) {
          factLine = `Taught ${rel.props.subject}`;
        } else if (rel.relation === 'classmate_of') {
          factLine = `Classmate in ${(rel.dst as any)?.name || 'school'}`;
        } else if (rel.occurred_on) {
          factLine = `Last seen on ${rel.occurred_on}`;
        } else {
          factLine = `Connected via: ${rel.relation.replace(/_/g, ' ')}`;
        }
      }
    } else if (entity.type === 'movie' || entity.type === 'book') {
      if (entity.props?.rating_10) {
        factLine = `Rating: ${entity.props.rating_10}/10`;
      }
    }

    // 2. Fallback to facts table
    if (!factLine) {
      const { data: facts } = await supabase
        .from('facts')
        .select('key, value')
        .eq('entity_id', id)
        .eq('user_id', user.id)
        .limit(1);

      if (facts && facts.length > 0) {
        factLine = `${facts[0].key}: ${facts[0].value}`;
      }
    }

    // 3. Fallback to entity summary or creation date
    if (!factLine && entity.summary) {
      factLine = entity.summary;
    }

    if (!factLine) {
      factLine = `Added to brain on ${new Date(entity.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    return NextResponse.json({
      entity,
      factLine
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
