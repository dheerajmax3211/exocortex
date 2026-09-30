-- ====================================================================
-- Virtual Brain: 001_init.sql
-- Core Database Schema, Indexes, RLS Policies, & Helper Functions
-- ====================================================================

-- 1. Extensions
create extension if not exists pg_trgm;
create extension if not exists vector;

-- 2. Tables

-- entries: raw, immutable text entries typed or spoken by user
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  raw_text text not null,
  entered_at timestamptz not null default now(),
  event_date date,
  date_end date,
  date_precision text not null default 'day', -- day|month|year|period|unknown
  source text default 'typed',                -- typed|voice|import|backfill
  status text not null default 'committed',   -- draft|committed
  fts tsvector generated always as (to_tsvector('simple', raw_text)) stored
);

-- entities: knowledge graph nodes
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null,              -- person|place|restaurant|dish|movie|show|book|school|org|period|event|item|other
  name text not null,
  aliases text[] not null default '{}',
  summary text,
  props jsonb not null default '{}',
  start_date date,
  end_date date,
  date_precision text,
  created_from_entry uuid references entries(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- edges: relationships between entities
create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  src uuid not null references entities(id) on delete cascade,
  dst uuid not null references entities(id) on delete cascade,
  relation text not null,          -- attended_with|at|served|ate|watched|taught|classmate_of|studied_at|lives_in ...
  props jsonb not null default '{}',   -- rating_10, sentiment (good|bad|neutral), quote, role, subject
  entry_id uuid references entries(id) on delete set null,
  occurred_on date,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- facts: discrete key-value facts attached to entities
create table if not exists facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  entity_id uuid not null references entities(id) on delete cascade,
  key text not null,
  value text not null,
  entry_id uuid references entries(id) on delete set null,
  as_of date
);

-- entry_entities: junction table linking entries to entities
create table if not exists entry_entities (
  entry_id uuid references entries(id) on delete cascade,
  entity_id uuid references entities(id) on delete cascade,
  primary key (entry_id, entity_id)
);

-- graph_layout: cached force-directed coordinates for Explore screen
create table if not exists graph_layout (
  entity_id uuid primary key references entities(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  x double precision not null,
  y double precision not null,
  updated_at timestamptz not null default now()
);

-- 3. Indexes
create index if not exists entities_name_trgm_idx on entities using gin (name gin_trgm_ops);
create index if not exists entities_user_type_idx on entities (user_id, type);

create index if not exists edges_src_idx on edges (src);
create index if not exists edges_dst_idx on edges (dst);
create index if not exists edges_relation_idx on edges (relation);

create index if not exists entries_fts_idx on entries using gin (fts);

-- 4. Row Level Security (RLS)
alter table entries enable row level security;
alter table entities enable row level security;
alter table edges enable row level security;
alter table facts enable row level security;
alter table entry_entities enable row level security;
alter table graph_layout enable row level security;

-- entries RLS
create policy "entries_select" on entries for select using (auth.uid() = user_id);
create policy "entries_insert" on entries for insert with check (auth.uid() = user_id);
create policy "entries_update" on entries for update using (auth.uid() = user_id);
create policy "entries_delete" on entries for delete using (auth.uid() = user_id);

-- entities RLS
create policy "entities_select" on entities for select using (auth.uid() = user_id);
create policy "entities_insert" on entities for insert with check (auth.uid() = user_id);
create policy "entities_update" on entities for update using (auth.uid() = user_id);
create policy "entities_delete" on entities for delete using (auth.uid() = user_id);

-- edges RLS
create policy "edges_select" on edges for select using (auth.uid() = user_id);
create policy "edges_insert" on edges for insert with check (auth.uid() = user_id);
create policy "edges_update" on edges for update using (auth.uid() = user_id);
create policy "edges_delete" on edges for delete using (auth.uid() = user_id);

-- facts RLS
create policy "facts_select" on facts for select using (auth.uid() = user_id);
create policy "facts_insert" on facts for insert with check (auth.uid() = user_id);
create policy "facts_update" on facts for update using (auth.uid() = user_id);
create policy "facts_delete" on facts for delete using (auth.uid() = user_id);

-- entry_entities RLS
create policy "entry_entities_select" on entry_entities for select using (
  exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
);
create policy "entry_entities_insert" on entry_entities for insert with check (
  exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
);
create policy "entry_entities_delete" on entry_entities for delete using (
  exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
);

-- graph_layout RLS
create policy "graph_layout_select" on graph_layout for select using (auth.uid() = user_id);
create policy "graph_layout_insert" on graph_layout for insert with check (auth.uid() = user_id);
create policy "graph_layout_update" on graph_layout for update using (auth.uid() = user_id);
create policy "graph_layout_delete" on graph_layout for delete using (auth.uid() = user_id);

-- 5. Helper SQL Functions

-- Search entities by name and aliases using trigram similarity
create or replace function search_entities(p_query text, p_user_id uuid default auth.uid())
returns setof entities as $$
begin
  return query
  select *
  from entities
  where user_id = p_user_id
    and deleted_at is null
    and (name ilike '%' || p_query || '%' or name % p_query or p_query = any(aliases))
  order by similarity(name, p_query) desc
  limit 25;
end;
$$ language plpgsql security definer;

-- Entity neighborhood with all connected edges and neighbor details
create or replace function entity_neighborhood(p_entity_id uuid, p_user_id uuid default auth.uid())
returns json as $$
declare
  result json;
begin
  select json_build_object(
    'entity', (select row_to_json(e) from entities e where id = p_entity_id and user_id = p_user_id),
    'facts', (select coalesce(json_agg(row_to_json(f)), '[]'::json) from facts f where entity_id = p_entity_id and user_id = p_user_id),
    'edges_out', (
      select coalesce(json_agg(row_to_json(out_edges)), '[]'::json)
      from edges out_edges
      where src = p_entity_id and user_id = p_user_id and deleted_at is null
    ),
    'edges_in', (
      select coalesce(json_agg(row_to_json(in_edges)), '[]'::json)
      from edges in_edges
      where dst = p_entity_id and user_id = p_user_id and deleted_at is null
    ),
    'neighbors', (
      select coalesce(json_agg(row_to_json(n)), '[]'::json)
      from entities n
      where user_id = p_user_id and deleted_at is null and id in (
        select dst from edges where src = p_entity_id and user_id = p_user_id and deleted_at is null
        union
        select src from edges where dst = p_entity_id and user_id = p_user_id and deleted_at is null
      )
    )
  ) into result;
  
  return result;
end;
$$ language plpgsql security definer;

-- List entities connected by a specific relation
create or replace function list_by_relation(p_entity_id uuid, p_relation text, p_user_id uuid default auth.uid())
returns setof entities as $$
begin
  return query
  select en.*
  from entities en
  join edges ed on (en.id = ed.dst or en.id = ed.src)
  where ed.user_id = p_user_id
    and ed.deleted_at is null
    and en.user_id = p_user_id
    and en.deleted_at is null
    and ed.relation = p_relation
    and (ed.src = p_entity_id or ed.dst = p_entity_id)
    and en.id != p_entity_id;
end;
$$ language plpgsql security definer;
create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  entity_id uuid not null references entities(id) on delete cascade,
  question_type text not null, -- 'who_taught', 'classmate', 'restaurant_dish', 'event_date'
  last_review timestamptz,
  next_review timestamptz not null default now(),
  ease_factor double precision not null default 2.5,
  interval_days integer not null default 1,
  repetitions integer not null default 0,
  created_at timestamptz default now()
);
alter table reviews enable row level security;
create policy reviews_user on reviews for all using (auth.uid() = user_id);
create index on reviews (user_id, next_review);
-- ====================================================================
-- Virtual Brain: 003_advanced_memory_graph.sql
-- Advanced Memory Graph Architecture:
-- 1. pgvector Embeddings for Entities & Entries (384-dim, all-MiniLM-L6-v2)
-- 2. Bi-Temporal Edge & Fact Versioning (valid_from/to & learned/invalidated)
-- 3. Cognitive Clusters / Living Themes (Hierarchical Community Detection)
-- 4. Hybrid GraphRAG SQL RPC (<50ms single-shot vector + topology traversal)
-- ====================================================================

-- 1. Ensure pgvector extension
create extension if not exists vector;

-- 2. Add embeddings to entities and entries
alter table entities add column if not exists embedding vector(384);
alter table entries add column if not exists embedding vector(384);

-- 3. Add bi-temporal versioning to edges & facts
alter table edges add column if not exists valid_from date;
alter table edges add column if not exists valid_to date;
alter table edges add column if not exists learned_at timestamptz default now();
alter table edges add column if not exists invalidated_at timestamptz;
alter table edges add column if not exists confidence double precision default 1.0;

alter table facts add column if not exists valid_from date;
alter table facts add column if not exists valid_to date;
alter table facts add column if not exists learned_at timestamptz default now();
alter table facts add column if not exists invalidated_at timestamptz;

-- 4. Cognitive Clusters (Hierarchical Themes / Mental Models)
create table if not exists clusters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  summary text,
  entity_ids uuid[] not null default '{}',
  embedding vector(384),
  updated_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- RLS for clusters
alter table clusters enable row level security;
create policy "clusters_select" on clusters for select using (auth.uid() = user_id);
create policy "clusters_insert" on clusters for insert with check (auth.uid() = user_id);
create policy "clusters_update" on clusters for update using (auth.uid() = user_id);
create policy "clusters_delete" on clusters for delete using (auth.uid() = user_id);

-- 5. Hybrid GraphRAG SQL Function
-- Takes a 384-dim query embedding, finds top semantic seeds, and expands their 1-hop topology in ONE sub-50ms query
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
    limit 30
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
