import { NextResponse } from 'next/server';

export async function GET() {
  // Triggered by Vercel cron
  try {
    // 1. Export data using admin client
    // 2. Commit to Github
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return NextResponse.json({ status: 'error', error: String(error) }, { status: 500 });
  }
}
