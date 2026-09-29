-- Virtual Brain: Core Database Migration (001_init.sql)
-- Stores a knowledge graph in plain Postgres.

-- 1. Extensions
create extension if not exists pg_trgm;
create extension if not exists vector;

-- 2. Tables

-- entries
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  raw_text text not null,
  event_date date,
  date_precision text,
  source text,
  status text,
  fts tsvector generated always as (to_tsvector('simple', raw_text)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- entities
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null, -- person, place, restaurant, dish, movie, show, book, school, org, period, event, item, other
  name text not null,
  aliases text[],
  summary text,
  props jsonb default '{}'::jsonb,
  start_date date,
  end_date date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- edges
create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  src_id uuid not null references entities(id) on delete cascade,
  dst_id uuid not null references entities(id) on delete cascade,
  relation text not null,
  props jsonb default '{}'::jsonb, -- rating_10, sentiment, quote, role, subject
  entry_id uuid references entries(id) on delete set null,
  occurred_on date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edges_src_dst_check check (src_id != dst_id)
);

-- facts
create table if not exists facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  entity_id uuid not null references entities(id) on delete cascade,
  key text not null,
  value jsonb not null,
  entry_id uuid references entries(id) on delete set null,
  as_of date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- entry_entities
create table if not exists entry_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  entry_id uuid not null references entries(id) on delete cascade,
  entity_id uuid not null references entities(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- graph_layout
create table if not exists graph_layout (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  entity_id uuid not null references entities(id) on delete cascade,
  x float not null,
  y float not null,
  fixed boolean default false,
  updated_at timestamptz not null default now(),
  unique(user_id, entity_id)
);

-- 3. Indexes
create index if not exists entities_name_trgm_idx on entities using gin (name gin_trgm_ops);
create index if not exists entities_user_type_idx on entities (user_id, type);

create index if not exists edges_src_idx on edges (src_id);
create index if not exists edges_dst_idx on edges (dst_id);
create index if not exists edges_relation_idx on edges (relation);

create index if not exists entries_fts_idx on entries using gin (fts);

-- 4. RLS policies
alter table entries enable row level security;
alter table entities enable row level security;
alter table edges enable row level security;
alter table facts enable row level security;
alter table entry_entities enable row level security;
alter table graph_layout enable row level security;

-- entries
create policy "Users can view their own entries" on entries for select using (auth.uid() = user_id);
create policy "Users can insert their own entries" on entries for insert with check (auth.uid() = user_id);
create policy "Users can update their own entries" on entries for update using (auth.uid() = user_id);
create policy "Users can delete their own entries" on entries for delete using (auth.uid() = user_id);

-- entities
create policy "Users can view their own entities" on entities for select using (auth.uid() = user_id);
create policy "Users can insert their own entities" on entities for insert with check (auth.uid() = user_id);
create policy "Users can update their own entities" on entities for update using (auth.uid() = user_id);
create policy "Users can delete their own entities" on entities for delete using (auth.uid() = user_id);

-- edges
create policy "Users can view their own edges" on edges for select using (auth.uid() = user_id);
create policy "Users can insert their own edges" on edges for insert with check (auth.uid() = user_id);
create policy "Users can update their own edges" on edges for update using (auth.uid() = user_id);
create policy "Users can delete their own edges" on edges for delete using (auth.uid() = user_id);

-- facts
create policy "Users can view their own facts" on facts for select using (auth.uid() = user_id);
create policy "Users can insert their own facts" on facts for insert with check (auth.uid() = user_id);
create policy "Users can update their own facts" on facts for update using (auth.uid() = user_id);
create policy "Users can delete their own facts" on facts for delete using (auth.uid() = user_id);

-- entry_entities
create policy "Users can view their own entry_entities" on entry_entities for select using (auth.uid() = user_id);
create policy "Users can insert their own entry_entities" on entry_entities for insert with check (auth.uid() = user_id);
create policy "Users can update their own entry_entities" on entry_entities for update using (auth.uid() = user_id);
create policy "Users can delete their own entry_entities" on entry_entities for delete using (auth.uid() = user_id);

-- graph_layout
create policy "Users can view their own graph_layout" on graph_layout for select using (auth.uid() = user_id);
create policy "Users can insert their own graph_layout" on graph_layout for insert with check (auth.uid() = user_id);
create policy "Users can update their own graph_layout" on graph_layout for update using (auth.uid() = user_id);
create policy "Users can delete their own graph_layout" on graph_layout for delete using (auth.uid() = user_id);

-- 5. Updated_at Trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger entities_updated_at
before update on entities
for each row execute function set_updated_at();

create trigger edges_updated_at
before update on edges
for each row execute function set_updated_at();

create trigger entries_updated_at
before update on entries
for each row execute function set_updated_at();

create trigger facts_updated_at
before update on facts
for each row execute function set_updated_at();

create trigger graph_layout_updated_at
before update on graph_layout
for each row execute function set_updated_at();

-- 6. Helper Functions

-- search_entities
create or replace function search_entities(p_query text, p_user_id uuid)
returns setof entities as $$
begin
  return query
  select *
  from entities
  where user_id = p_user_id
    and deleted_at is null
    and (name ilike '%' || p_query || '%' or name % p_query)
  order by similarity(name, p_query) desc
  limit 20;
end;
$$ language plpgsql security definer;

-- entity_neighborhood
create or replace function entity_neighborhood(p_entity_id uuid, p_user_id uuid)
returns json as $$
declare
  result json;
begin
  select json_build_object(
    'entity', (select row_to_json(e) from entities e where id = p_entity_id and user_id = p_user_id),
    'edges_out', (
      select coalesce(json_agg(row_to_json(out_edges)), '[]'::json)
      from edges out_edges
      where src_id = p_entity_id and user_id = p_user_id and deleted_at is null
    ),
    'edges_in', (
      select coalesce(json_agg(row_to_json(in_edges)), '[]'::json)
      from edges in_edges
      where dst_id = p_entity_id and user_id = p_user_id and deleted_at is null
    ),
    'neighbors', (
      select coalesce(json_agg(row_to_json(n)), '[]'::json)
      from entities n
      where user_id = p_user_id and deleted_at is null and id in (
        select dst_id from edges where src_id = p_entity_id and user_id = p_user_id and deleted_at is null
        union
        select src_id from edges where dst_id = p_entity_id and user_id = p_user_id and deleted_at is null
      )
    )
  ) into result;
  
  return result;
end;
$$ language plpgsql security definer;

-- list_by_relation
create or replace function list_by_relation(p_entity_id uuid, p_relation text, p_user_id uuid)
returns setof entities as $$
begin
  return query
  select en.*
  from entities en
  join edges ed on (en.id = ed.dst_id or en.id = ed.src_id)
  where ed.user_id = p_user_id
    and ed.deleted_at is null
    and en.user_id = p_user_id
    and en.deleted_at is null
    and ed.relation = p_relation
    and (ed.src_id = p_entity_id or ed.dst_id = p_entity_id)
    and en.id != p_entity_id;
end;
$$ language plpgsql security definer;
