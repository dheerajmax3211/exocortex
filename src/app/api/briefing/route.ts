import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const entity_id = searchParams.get('entity_id');
    
    if (!entity_id) {
      return NextResponse.json({ error: 'Missing entity_id' }, { status: 400 });
    }

    // Fetch entity neighborhood
    // Generate briefing with LLM
    const briefing = `Briefing for ${entity_id}: You met them at the conference. Last interaction was 2 weeks ago discussing project X.`;
    
    return NextResponse.json({ briefing });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
