import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { items, type, action } = await req.json();

    if (action === 'preview') {
      // Mock LLM normalization & deduplication
      const normalized = items.map((item: string) => {
        const parts = item.split('|').map(s => s.trim());
        return { title: parts[0], year: parts.length > 2 ? parts[2] : null };
      });
      
      return NextResponse.json({
        new: normalized, // in reality, check DB
        existing: [],
        duplicates: []
      });
    }

    if (action === 'commit') {
      // Mock DB commit
      // Create entities & edges to "Me"
      return NextResponse.json({ success: true, count: items.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
