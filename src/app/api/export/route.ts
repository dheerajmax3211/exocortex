import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format');

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

    if (format === 'obsidian') {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const sanitizeName = (name: string) => (name || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-');

      const entityMap = new Map();
      for (const ent of entities) {
        entityMap.set(ent.id, ent);
      }

      for (const ent of entities) {
        const title = sanitizeName(ent.name);
        
        let md = '---\n';
        md += `id: "${ent.id}"\n`;
        md += `type: "${ent.type || 'unknown'}"\n`;
        
        if (ent.aliases && Array.isArray(ent.aliases) && ent.aliases.length > 0) {
          md += `aliases:\n`;
          ent.aliases.forEach((a: string) => {
            md += `  - "${a.replace(/"/g, '\\"')}"\n`;
          });
        }
        if (ent.created_at) md += `created_at: "${ent.created_at}"\n`;
        if (ent.start_date) md += `start_date: "${ent.start_date}"\n`;
        if (ent.end_date) md += `end_date: "${ent.end_date}"\n`;
        
        if (ent.props && Object.keys(ent.props).length > 0) {
          md += `props:\n`;
          for (const [k, v] of Object.entries(ent.props)) {
            if (typeof v === 'string') {
              md += `  ${k}: "${v.replace(/"/g, '\\"')}"\n`;
            } else if (v !== null && v !== undefined) {
              md += `  ${k}: ${JSON.stringify(v)}\n`;
            }
          }
        }
        md += '---\n\n';

        if (ent.summary) {
          md += `${ent.summary}\n\n`;
        } else if (ent.description) {
          md += `${ent.description}\n\n`;
        }

        const entFacts = facts.filter((f: any) => f.entity_id === ent.id);
        if (entFacts.length > 0) {
          md += `## Discrete Facts\n`;
          for (const f of entFacts) {
            md += `- **${f.key || 'Fact'}**: ${f.value || ''}\n`;
          }
          md += `\n`;
        }

        const entEdges = edges.filter((e: any) => e.source_id === ent.id);
        if (entEdges.length > 0) {
          md += `## Connected Relations\n`;
          for (const e of entEdges) {
            const target = entityMap.get(e.target_id);
            if (target) {
              md += `- **${e.relation_type || 'relates to'}** -> [[${sanitizeName(target.name)}]]\n`;
            }
          }
          md += `\n`;
        }

        zip.file(`${title}.md`, md);
      }

      const byType: Record<string, any[]> = {};
      for (const ent of entities) {
        const type = ent.type || 'unknown';
        if (!byType[type]) byType[type] = [];
        byType[type].push(ent);
      }

      let indexMd = `# Knowledge Graph Index\n\n`;
      for (const [type, ents] of Object.entries(byType).sort()) {
        indexMd += `## ${type.toUpperCase()}\n`;
        for (const ent of ents) {
          indexMd += `- [[${sanitizeName(ent.name)}]]\n`;
        }
        indexMd += `\n`;
      }
      zip.file('00_Knowledge_Graph_Index.md', indexMd);

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      return new NextResponse(zipBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="VirtualBrain-Obsidian-Vault.zip"`
        }
      });
    }

    // Default JSON Export (Original behavior)
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
