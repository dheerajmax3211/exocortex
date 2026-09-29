import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Trivial query to keep the project active on Supabase Free Tier
    await supabase.rpc('search_entities', { p_query: 'keepalive', p_user_id: '00000000-0000-0000-0000-000000000000' });
    
    return NextResponse.json({ 
      success: true, 
      maintenance: 'Cognitive keepalive completed',
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
