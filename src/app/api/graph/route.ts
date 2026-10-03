import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateMeEntity } from '@/lib/db';
import { analyzeKnowledgeGraphHybrid } from '@/lib/graph-analytics';
import { isDomainHubName, isCategoryName } from '@/lib/graph-hierarchy';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parentContextId = url.searchParams.get('parent');
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const me = await getOrCreateMeEntity(supabase, user.id);

    // Fetch ALL entities
    
    let entQuery = supabase
      .from('entities')
      .select('id, name, type, summary, props')
      .eq('user_id', user.id)
      .is('deleted_at', null);
      
    if (parentContextId) {
      entQuery = entQuery.eq('parent_context_id', parentContextId);
    } else {
      entQuery = entQuery.is('parent_context_id', null);
    }
    const { data: entities, error: entError } = await entQuery;


    if (entError) throw entError;

    // Fetch edges
    
    let edgeQuery = supabase
      .from('edges')
      .select('src, dst, relation')
      .eq('user_id', user.id)
      .is('deleted_at', null);
      
    if (parentContextId) {
      edgeQuery = edgeQuery.eq('parent_context_id', parentContextId);
    } else {
      edgeQuery = edgeQuery.is('parent_context_id', null);
    }
    const { data: edges, error: edgesError } = await edgeQuery;


    if (edgesError) throw edgesError;

    // Run Graph Data Science Analytics: PageRank, Degree Centrality, and Bridge Detection
    const analyticsResult = await analyzeKnowledgeGraphHybrid(
      supabase,
      user.id,
      (entities || []).map(e => ({ id: e.id, name: e.name, type: e.type })),
      (edges || []).map(e => ({ src: e.src, dst: e.dst, relation: e.relation }))
    );

    const activeTensions = me.props?.mind_state?.active_tensions || me.props?.mind_state?.tensions || me.props?.active_tensions || [];

    // Format nodes for react-force-graph-3d
    const nodes = (entities || []).map((e: any) => {
      const isUser = e.id === me.id;
      const deg = analyticsResult.degreeCentrality.get(e.id) || 0;
      const normalizedScore = analyticsResult.normalizedScores.get(e.id) || 2.0;
      const isBridge = analyticsResult.bridgeNodes.has(e.id);

      let isTension = false;
      let tensionSeverity = undefined;
      let tensionHeadline = undefined;

      for (const t of activeTensions) {
        const related = t.related_entities || [];
        const keywords = t.keywords || [];
        
        const matchesEntity = related.some((r: any) => 
          (typeof r === 'string' && (r.toLowerCase() === e.name.toLowerCase() || r === e.id)) ||
          (r.id && r.id === e.id) ||
          (r.name && r.name.toLowerCase() === e.name.toLowerCase())
        );
        
        const matchesKeyword = keywords.some((k: string) => 
          typeof k === 'string' && e.name.toLowerCase().includes(k.toLowerCase())
        );

        if (matchesEntity || matchesKeyword) {
          isTension = true;
          tensionSeverity = t.severity;
          tensionHeadline = t.headline;
          break;
        }
      }

      const isDomainHub = Boolean(
        e.props?.is_domain_hub || isDomainHubName(e.name)
      );

      const isCategory = Boolean(
        e.props?.is_category || isCategoryName(e.name)
      );

      return {
        id: e.id,
        name: e.name,
        type: e.type,
        val: isUser ? 10 : (isDomainHub ? 7.0 : (isCategory ? 5.0 : normalizedScore)), // Hierarchical visual scale
        connectionCount: deg,
        isBridge,
        isUser,
        isDomainHub,
        isCategory,
        props: e.props || {},
        isTension,
        tensionSeverity,
        tensionHeadline,
        // Pin root user entity exactly at origin (0, 0, 0)
        ...(isUser ? { fx: 0, fy: 0, fz: 0 } : {}),
      };
    });

    // Format links
    const links = (edges || []).map((e: any) => ({
      source: e.src,
      target: e.dst,
      relation: e.relation,
    }));

    // Fetch cognitive clusters
    const { data: clusters } = await supabase
      .from('clusters')
      .select('id, name, entity_ids')
      .eq('user_id', user.id);

    return NextResponse.json({
      nodes,
      links,
      clusters: clusters || [],
      nodeCount: nodes.length,
      edgeCount: links.length,
    });
  } catch (error: any) {
    console.error('Graph API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
