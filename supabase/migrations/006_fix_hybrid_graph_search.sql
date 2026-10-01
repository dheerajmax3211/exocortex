-- Migration 006: Fix hybrid_graph_search fact ordering
-- Prioritize facts belonging directly to matched seed entities over neighbor entities
-- and order by recency (learned_at desc) so new facts are never cut off by limit 30.

create or replace function hybrid_graph_search(
  p_query_embedding vector(384),
  p_user_id uuid default auth.uid(),
  p_match_count int default 8,
  p_similarity_threshold float default 0.25
)
returns json as $$
declare
  result json;
begin
  with matched_seeds as (
    select 
      e.id,
      e.name,
      e.type,
      e.summary,
      e.props,
      1 - (e.embedding <=> p_query_embedding) as similarity
    from entities e
    where e.user_id = p_user_id
      and e.deleted_at is null
      and e.embedding is not null
      and (1 - (e.embedding <=> p_query_embedding)) > p_similarity_threshold
    order by e.embedding <=> p_query_embedding
    limit p_match_count
  ),
  seed_ids as (
    select id from matched_seeds
  ),
  connected_edges as (
    select 
      ed.id,
      ed.src,
      ed.dst,
      ed.relation,
      ed.props,
      ed.occurred_on,
      ed.valid_from,
      ed.valid_to
    from edges ed
    where ed.user_id = p_user_id
      and ed.deleted_at is null
      and ed.invalidated_at is null
      and (ed.src in (select id from seed_ids) or ed.dst in (select id from seed_ids))
    limit 40
  ),
  neighbor_entities as (
    select distinct 
      n.id,
      n.name,
      n.type,
      n.summary,
      n.props
    from entities n
    where n.user_id = p_user_id
      and n.deleted_at is null
      and n.id in (
        select src from connected_edges union select dst from connected_edges
      )
      and n.id not in (select id from seed_ids)
    limit 30
  ),
  relevant_facts as (
    select 
      f.id,
      f.entity_id,
      f.key,
      f.value
    from facts f
    where f.user_id = p_user_id
      and f.invalidated_at is null
      and (f.entity_id in (select id from seed_ids) or f.entity_id in (select id from neighbor_entities))
    order by 
      case when f.entity_id in (select id from seed_ids) then 0 else 1 end,
      f.learned_at desc nulls last
    limit 40
  ),
  matched_clusters as (
    select 
      c.id,
      c.name,
      c.summary,
      1 - (c.embedding <=> p_query_embedding) as cluster_similarity
    from clusters c
    where c.user_id = p_user_id
      and c.embedding is not null
    order by c.embedding <=> p_query_embedding
    limit 3
  )
  select json_build_object(
    'seeds', coalesce((select json_agg(row_to_json(m)) from matched_seeds m), '[]'::json),
    'edges', coalesce((select json_agg(row_to_json(ce)) from connected_edges ce), '[]'::json),
    'neighbors', coalesce((select json_agg(row_to_json(ne)) from neighbor_entities ne), '[]'::json),
    'facts', coalesce((select json_agg(row_to_json(rf)) from relevant_facts rf), '[]'::json),
    'clusters', coalesce((select json_agg(row_to_json(mc)) from matched_clusters mc), '[]'::json)
  ) into result;

  return result;
end;
$$ language plpgsql security definer;
