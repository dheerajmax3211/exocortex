import { NextResponse } from 'next/server';

export async function GET() {
  // Fetch ALL tables here
  const data = {
    entities: [],
    entries: [],
    edges: [],
    facts: [],
  };

  const summary = `# Export Summary\n\nTotal Entities: 0\nTotal Entries: 0`;

  return new NextResponse(JSON.stringify({ data, summary }), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="virtual_dheeraj_backup.json"'
    }
  });
}
