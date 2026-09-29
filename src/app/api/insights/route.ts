import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';

const insightsSchema = z.object({
  insights: z.array(z.string().describe("A gentle, accurate insight based strictly on the provided SQL statistics"))
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Compute real statistical aggregates from Postgres
    const [countsRes, topRestaurantsRes, topPeopleRes, ratedDishesRes, recentMonthsRes] = await Promise.all([
      supabase.from('entities').select('type', { count: 'exact' }).eq('user_id', user.id).is('deleted_at', null),
      supabase.from('entities').select('name').eq('user_id', user.id).eq('type', 'restaurant').limit(10),
      supabase.from('entities').select('name').eq('user_id', user.id).eq('type', 'person').neq('name', 'Me').limit(10),
      supabase.from('edges').select('props, dst:entities!edges_dst_fkey(name)').eq('user_id', user.id).eq('relation', 'tried').not('props->>rating_10', 'is', null).limit(10),
      supabase.from('entries').select('event_date, entered_at').eq('user_id', user.id).order('entered_at', { ascending: false }).limit(50)
    ]);

    const entityCounts: Record<string, number> = {};
    for (const row of countsRes.data || []) {
      entityCounts[row.type] = (entityCounts[row.type] || 0) + 1;
    }

    const restaurants = (topRestaurantsRes.data || []).map(r => r.name);
    const people = (topPeopleRes.data || []).map(p => p.name);
    const ratedDishes = (ratedDishesRes.data || []).map((d: any) => ({
      dish: d.dst?.name,
      rating: d.props?.rating_10
    }));

    if (Object.keys(entityCounts).length === 0) {
      return NextResponse.json({
        insights: [
          'Your brain is waiting for its first memories. Record what you did today to unlock personalized patterns!'
        ]
      });
    }

    // 2. Have the LLM phrase gentle insights strictly using the computed statistics
    const prompt = `Real Memory Database Statistics:
- Entity Counts by Category: ${JSON.stringify(entityCounts)}
- Known Restaurants: ${JSON.stringify(restaurants)}
- Frequent Companions / People: ${JSON.stringify(people)}
- Sample Rated Dishes: ${JSON.stringify(ratedDishes)}
- Total Recent Memory Entries: ${recentMonthsRes.data?.length || 0}

Rules:
- Formulate 3 gentle, warm observations or insights strictly derived from these real numbers.
- NEVER invent numbers, dates, or names not present in the data.`;

    const result = await chatJSON({
      system: 'You are a warm, reflective memory biographer phrasing statistical patterns into gentle insights.',
      prompt,
      schema: insightsSchema
    });

    return NextResponse.json({
      insights: result.insights || [],
      rawStats: {
        entityCounts,
        totalEntries: recentMonthsRes.data?.length || 0
      }
    });
  } catch (error: any) {
    console.error('Insights error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
