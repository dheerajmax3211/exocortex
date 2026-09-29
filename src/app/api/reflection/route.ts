import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch entries from past 7 days
    // Generate reflection with LLM
    const reflection = `# Weekly Reflection\n\nThis week you focused on X, Y, and Z.`;
    return NextResponse.json({ reflection });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
