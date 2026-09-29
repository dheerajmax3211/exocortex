import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      email: user.email,
      provider: process.env.LLM_PROVIDER || 'openai',
      model: process.env.LLM_MODEL || (process.env.LLM_PROVIDER === 'commandcode' ? 'deepseek/deepseek-v4-flash' : 'deepseek-flash'),
      baseUrl: process.env.LLM_BASE_URL || (process.env.LLM_PROVIDER === 'commandcode' ? 'https://api.commandcode.ai' : 'https://api.deepseek.com'),
      timezone: 'Asia/Kolkata',
      backupRepo: process.env.GITHUB_BACKUP_REPO || 'Not configured'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
