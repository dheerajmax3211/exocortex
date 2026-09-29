import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user data across all tables
    const [entriesRes, entitiesRes, edgesRes, factsRes, entryEntitiesRes, layoutRes] = await Promise.all([
      supabase.from('entries').select('*').eq('user_id', user.id).order('entered_at', { ascending: false }),
      supabase.from('entities').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('edges').select('*').eq('user_id', user.id).is('deleted_at', null),
      supabase.from('facts').select('*').eq('user_id', user.id),
      supabase.from('entry_entities').select('*'),
      supabase.from('graph_layout').select('*').eq('user_id', user.id)
    ]);

    const entries = entriesRes.data || [];
    const entities = entitiesRes.data || [];
    const edges = edgesRes.data || [];
    const facts = factsRes.data || [];
    const entryEntities = entryEntitiesRes.data || [];
    const graphLayout = layoutRes.data || [];

    // Group entities by type
    const byType: Record<string, number> = {};
    for (const ent of entities) {
      byType[ent.type] = (byType[ent.type] || 0) + 1;
    }

    // Generate human-readable Markdown summary
    let markdown = `# Virtual Brain Data Export\n\n`;
    markdown += `**Export Date:** ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)\n\n`;
    markdown += `## Graph Statistics\n`;
    markdown += `- **Total Raw Memories:** ${entries.length}\n`;
    markdown += `- **Total Entities:** ${entities.length}\n`;
    markdown += `- **Total Connections/Opinions:** ${edges.length}\n`;
    markdown += `- **Total Grounded Facts:** ${facts.length}\n\n`;

    markdown += `### Entities by Type\n`;
    for (const [type, count] of Object.entries(byType)) {
      markdown += `- **${type.toUpperCase()}:** ${count}\n`;
    }
    markdown += `\n`;

    markdown += `## Memory Timeline (Latest 50 Entries)\n\n`;
    for (const entry of entries.slice(0, 50)) {
      const dateStr = entry.event_date || new Date(entry.entered_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      markdown += `### ${dateStr} [${entry.source || 'typed'}]\n`;
      markdown += `> ${entry.raw_text.replace(/\n/g, '\n> ')}\n\n`;
    }

    const payload = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      stats: {
        entries_count: entries.length,
        entities_count: entities.length,
        edges_count: edges.length,
        facts_count: facts.length
      },
      markdown_summary: markdown,
      tables: {
        entries,
        entities,
        edges,
        facts,
        entry_entities: entryEntities,
        graph_layout: graphLayout
      }
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="virtual_brain_backup_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
