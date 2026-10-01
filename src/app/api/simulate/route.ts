import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { simulateScenario } from '@/lib/decision-simulator';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scenario } = await req.json();
    if (!scenario || typeof scenario !== 'string' || scenario.trim().length < 5) {
      return NextResponse.json({ error: 'Valid scenario description is required' }, { status: 400 });
    }

    const result = await simulateScenario(scenario.trim(), supabase);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Simulation error:', error);
    return NextResponse.json({ error: error.message || 'Simulation failed' }, { status: 500 });
  }
}
