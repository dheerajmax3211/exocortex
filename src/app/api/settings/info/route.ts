import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEnvConfig } from '@/lib/llm';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, model, baseUrl } = getEnvConfig();

    return NextResponse.json({
      email: user.email,
      provider,
      model,
      baseUrl,
      isLocal: provider === 'ollama' || provider === 'local' || provider === 'lmstudio' || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'),
      timezone: 'Asia/Kolkata',
      backupRepo: process.env.GITHUB_BACKUP_REPO || 'Not configured'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
