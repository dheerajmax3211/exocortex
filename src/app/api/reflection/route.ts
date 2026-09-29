import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';

const reflectionSchema = z.object({
  title: z.string(),
  reflection: z.string(),
  highlights: z.array(z.string()),
  themes: z.array(z.string())
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch entries from the past 7 days (or latest 15 if sparse)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    let { data: entries } = await supabase
      .from('entries')
      .select('raw_text, event_date, source, entered_at')
      .eq('user_id', user.id)
      .gte('entered_at', sevenDaysAgo)
      .order('entered_at', { ascending: false });

    if (!entries || entries.length === 0) {
      // Fallback to latest 10 entries overall
      const { data: latest } = await supabase
        .from('entries')
        .select('raw_text, event_date, source, entered_at')
        .eq('user_id', user.id)
        .order('entered_at', { ascending: false })
        .limit(10);
      entries = latest || [];
    }

    if (entries.length === 0) {
      return NextResponse.json({
        title: 'No Memories Recorded Yet',
        reflection: 'You have not recorded any memories yet. Start typing your daily experiences, meals, and thoughts to generate your weekly reflection!',
        highlights: [],
        themes: []
      });
    }

    // 2. Fetch recent entities created
    const { data: recentEntities } = await supabase
      .from('entities')
      .select('name, type, summary')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(15);

    const istNow = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const prompt = `Current Date (IST): ${istNow}
Recent Memory Entries:
${entries.map(e => `- [${e.event_date || e.entered_at.split('T')[0]}] ${e.raw_text}`).join('\n')}

Recent Entities Added:
${(recentEntities || []).map(e => `- ${e.name} (${e.type})`).join('\n')}

Generate a warm, perceptive, second-person weekly digest reflecting on what happened, patterns noticed, people met, and experiences recorded.`;

    const result = await chatJSON({
      system: 'You are a thoughtful personal memory biographer crafting weekly reflections.',
      prompt,
      schema: reflectionSchema,
      temperature: 0.7
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Reflection error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
