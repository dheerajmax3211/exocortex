import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { primaryId, secondaryId } = await req.json();
    
    // Merge logic:
    // 1. repoint all edges from secondary to primary
    // 2. union aliases
    // 3. delete secondary's graph_layout
    // 4. soft delete secondary

    return NextResponse.json({ success: true, primaryId, secondaryId });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
