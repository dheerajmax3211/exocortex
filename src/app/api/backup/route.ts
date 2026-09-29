import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function commitFileToGitHub(
  token: string,
  repo: string,
  filePath: string,
  contentStr: string,
  message: string
) {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'VirtualBrain-Backup-Bot'
  };

  // 1. Check if file already exists to get SHA
  let sha: string | undefined;
  try {
    const existingRes = await fetch(url, { headers });
    if (existingRes.ok) {
      const existingData = await existingRes.json();
      sha = existingData.sha;
    }
  } catch (e) {
    // File may not exist yet, which is fine
  }

  // 2. Put / update file with base64 content
  const body = {
    message,
    content: Buffer.from(contentStr, 'utf-8').toString('base64'),
    sha
  };

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub commit failed for ${filePath}: ${putRes.status} ${errText}`);
  }

  return await putRes.json();
}

export async function GET(req: Request) {
  // Triggered weekly by Vercel Cron or manual request
  try {
    const supabase = createAdminClient();
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_BACKUP_REPO;

    if (!token || !repo) {
      return NextResponse.json({
        status: 'skipped',
        message: 'GITHUB_TOKEN or GITHUB_BACKUP_REPO not configured in environment variables'
      });
    }

    // 1. Fetch all data across tables
    const [entriesRes, entitiesRes, edgesRes, factsRes, layoutRes] = await Promise.all([
      supabase.from('entries').select('*').order('entered_at', { ascending: false }),
      supabase.from('entities').select('*').is('deleted_at', null),
      supabase.from('edges').select('*').is('deleted_at', null),
      supabase.from('facts').select('*'),
      supabase.from('graph_layout').select('*')
    ]);

    const entries = entriesRes.data || [];
    const entities = entitiesRes.data || [];
    const edges = edgesRes.data || [];
    const facts = factsRes.data || [];
    const layout = layoutRes.data || [];

    const dateStr = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const summaryMd = `# Virtual Brain Weekly Backup — ${dateStr}\n\n` +
      `**Backup Created:** ${timestamp} (IST)\n\n` +
      `## Summary\n` +
      `- Entries: ${entries.length}\n` +
      `- Entities: ${entities.length}\n` +
      `- Edges: ${edges.length}\n` +
      `- Facts: ${facts.length}\n` +
      `- Layout Positions: ${layout.length}\n`;

    // 2. Commit each file to GitHub
    const results = await Promise.all([
      commitFileToGitHub(token, repo, 'backup/entries.json', JSON.stringify(entries, null, 2), `backup: entries ${dateStr}`),
      commitFileToGitHub(token, repo, 'backup/entities.json', JSON.stringify(entities, null, 2), `backup: entities ${dateStr}`),
      commitFileToGitHub(token, repo, 'backup/edges.json', JSON.stringify(edges, null, 2), `backup: edges ${dateStr}`),
      commitFileToGitHub(token, repo, 'backup/facts.json', JSON.stringify(facts, null, 2), `backup: facts ${dateStr}`),
      commitFileToGitHub(token, repo, 'backup/summary.md', summaryMd, `backup: summary ${dateStr}`)
    ]);

    return NextResponse.json({
      status: 'success',
      date: dateStr,
      committedFiles: ['backup/entries.json', 'backup/entities.json', 'backup/edges.json', 'backup/facts.json', 'backup/summary.md'],
      resultsCount: results.length
    });
  } catch (error: any) {
    console.error('Weekly backup cron failed:', error);
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}
