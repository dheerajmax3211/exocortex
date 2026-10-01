-- 1. Hybrid search function (replaces old search_entities)
drop function if exists search_entities(text, uuid);

create or replace function search_entities(
  p_query text,
  p_query_embedding vector(384) default null,
  p_match_threshold float default 0.7,
  p_user_id uuid default auth.uid()
)
returns setof entities as $$
begin
  return query
  select *
  from entities
  where user_id = p_user_id
    and deleted_at is null
    and (
      (p_query <> '' and (
        name ilike '%' || p_query || '%' 
        or name % p_query 
        or p_query = any(aliases)
        or array_to_string(aliases, ' ') % p_query
      ))
      or
      (p_query_embedding is not null and embedding is not null and (1 - (embedding <=> p_query_embedding)) > p_match_threshold)
    )
  order by 
    (
      (case when p_query <> '' then greatest(similarity(name, p_query), similarity(array_to_string(aliases, ' '), p_query)) else 0 end) * 0.4 +
      (case when p_query_embedding is not null and embedding is not null then (1 - (embedding <=> p_query_embedding)) else 0 end) * 0.6
    ) desc
  limit 25;
end;
$$ language plpgsql security definer;

-- 2. Duplicate Detection Function
create or replace function find_duplicate_entities(
  p_similarity_threshold float default 0.98,
  p_user_id uuid default null
)
returns table (
  target_id uuid,
  source_id uuid,
  target_name text,
  source_name text,
  similarity float
) as $$
begin
  return query
  select 
    e1.id as target_id,
    e2.id as source_id,
    e1.name as target_name,
    e2.name as source_name,
    (1 - (e1.embedding <=> e2.embedding))::float as similarity
  from entities e1
  join entities e2 on (e1.user_id = e2.user_id or p_user_id is null)
                   and e1.id < e2.id
                   and e1.type = e2.type
  where (p_user_id is null or e1.user_id = p_user_id)
    and e1.deleted_at is null
    and e2.deleted_at is null
    and e1.embedding is not null
    and e2.embedding is not null
    and (1 - (e1.embedding <=> e2.embedding)) > p_similarity_threshold
  order by similarity desc;
end;
$$ language plpgsql security definer;
