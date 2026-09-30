import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatJSON } from '@/lib/llm';
import { z } from 'zod';

const quizGenerationSchema = z.object({
  question: z.string(),
  correct_answer: z.string(),
  hint: z.string().optional()
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Check if there are reviews due in reviews table
    const { data: dueReview } = await supabase
      .from('reviews')
      .select('*, entity:entities!reviews_entity_id_fkey(*)')
      .eq('user_id', user.id)
      .lte('next_review', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    let targetEntityId: string;
    let questionType: string = 'fact_recall';

    if (dueReview && dueReview.entity) {
      targetEntityId = dueReview.entity_id;
      questionType = dueReview.question_type;
    } else {
      const { getOrCreateMeEntity } = await import('@/lib/db');
      const me = await getOrCreateMeEntity(supabase, user.id);

      // Pick a random entity with edges or facts
      const { data: randomEntities } = await supabase
        .from('entities')
        .select('id, name, type, summary, props')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .neq('id', me.id)
        .limit(20);

      if (!randomEntities || randomEntities.length === 0) {
        return NextResponse.json({
          message: 'No entities recorded in your brain yet. Add memories first to take a quiz!'
        });
      }

      const picked = randomEntities[Math.floor(Math.random() * randomEntities.length)];
      targetEntityId = picked.id;
    }

    // Fetch neighborhood / facts of target entity
    const [entityRes, factsRes, edgesRes] = await Promise.all([
      supabase.from('entities').select('*').eq('id', targetEntityId).single(),
      supabase.from('facts').select('key, value').eq('entity_id', targetEntityId),
      supabase.from('edges').select('relation, props, dst:entities!edges_dst_fkey(name), src:entities!edges_src_fkey(name)').or(`src.eq.${targetEntityId},dst.eq.${targetEntityId}`).limit(5)
    ]);

    const entity = entityRes.data;
    const facts = factsRes.data || [];
    const edges = edgesRes.data || [];

    // Use LLM to generate a question testing personal memory recall
    const llmPrompt = `Generate a recall quiz question based on this entity from the user's personal memory graph:
Entity Name: "${entity.name}" (${entity.type})
Summary: "${entity.summary || 'None'}"
Discrete Facts: ${JSON.stringify(facts)}
Relationships: ${JSON.stringify(edges.map((e: any) => ({
      relation: e.relation,
      props: e.props,
      connected_to: e.dst?.name === entity.name ? e.src?.name : e.dst?.name
    })))}

Rules:
- The question must ask about a specific detail (e.g. who taught a subject, what food was tried, when an event happened, what someone's role was).
- The correct_answer must be precise and match the graph data.`;

    const generated = await chatJSON({
      system: 'You are an educational quiz creator testing personal memory recall.',
      prompt: llmPrompt,
      schema: quizGenerationSchema
    });

    return NextResponse.json({
      entity_id: targetEntityId,
      entity_name: entity.name,
      question_type: questionType,
      question: generated.question,
      correct_answer: generated.correct_answer,
      hint: generated.hint || null
    });
  } catch (error: any) {
    console.error('Quiz GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_id, answer, correct_answer, question_type } = await req.json();

    if (!entity_id || typeof answer !== 'string') {
      return NextResponse.json({ error: 'entity_id and answer are required' }, { status: 400 });
    }

    // Fuzzy check answer
    const normUser = answer.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const normCorrect = (correct_answer || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const isCorrect = normUser.length > 2 && (normCorrect.includes(normUser) || normUser.includes(normCorrect));

    // Fetch existing review schedule for SM-2
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('entity_id', entity_id)
      .maybeSingle();

    let easeFactor = existingReview?.ease_factor || 2.5;
    let intervalDays = existingReview?.interval_days || 1;
    let repetitions = existingReview?.repetitions || 0;

    // SM-2 Spaced Repetition calculation
    if (isCorrect) {
      repetitions += 1;
      if (repetitions === 1) intervalDays = 1;
      else if (repetitions === 2) intervalDays = 6;
      else intervalDays = Math.round(intervalDays * easeFactor);

      easeFactor = Math.max(1.3, easeFactor + 0.1);
    } else {
      repetitions = 0;
      intervalDays = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

    const nextReview = new Date(Date.now() + intervalDays * 86400000).toISOString();

    // Upsert review record
    await supabase.from('reviews').upsert({
      user_id: user.id,
      entity_id,
      question_type: question_type || 'general',
      last_review: new Date().toISOString(),
      next_review: nextReview,
      ease_factor: easeFactor,
      interval_days: intervalDays,
      repetitions
    }, { onConflict: 'user_id,entity_id' });

    return NextResponse.json({
      correct: isCorrect,
      correctAnswer: correct_answer,
      nextReview,
      intervalDays,
      message: isCorrect ? 'Great memory recall!' : 'Keep reviewing to reinforce this memory.'
    });
  } catch (error: any) {
    console.error('Quiz POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
