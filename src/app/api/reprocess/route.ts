import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (body.entry_id) {
      // Reprocess single entry
      return NextResponse.json({ success: true, entry_id: body.entry_id });
    } else if (body.action === 'all') {
      // Reprocess all
      return NextResponse.json({ success: true, message: 'Reprocessing all' });
    }

    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
