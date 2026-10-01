-- ====================================================================
-- Virtual Brain: 004_living_intelligence_engine.sql
-- Autonomous Cognitive Synthesis, Life Vectors, & Decision Simulations
-- ====================================================================

-- 1. Cognitive Syntheses & Tensions Table
create table if not exists cognitive_syntheses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  dimension text not null, -- 'career', 'finance', 'fitness', 'mindset', 'cross_domain_tension'
  headline text not null,
  analysis text not null,
  actionable_verdict text,
  status text not null default 'active', -- 'active' | 'resolved' | 'monitoring'
  confidence double precision default 0.9,
  entity_ids uuid[] default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- RLS
alter table cognitive_syntheses enable row level security;
create policy "syntheses_select" on cognitive_syntheses for select using (auth.uid() = user_id);
create policy "syntheses_insert" on cognitive_syntheses for insert with check (auth.uid() = user_id);
create policy "syntheses_update" on cognitive_syntheses for update using (auth.uid() = user_id);
create policy "syntheses_delete" on cognitive_syntheses for delete using (auth.uid() = user_id);

-- 2. Life Vectors & State of Mind
create table if not exists life_vectors (
  user_id uuid primary key default auth.uid(),
  career_score integer not null default 50,      -- 0-100
  finance_score integer not null default 50,     -- 0-100
  fitness_score integer not null default 50,     -- 0-100
  execution_score integer not null default 50,   -- 0-100
  mindset_score integer not null default 50,     -- 0-100
  daily_subconscious_thought text,
  active_tensions_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table life_vectors enable row level security;
create policy "vectors_select" on life_vectors for select using (auth.uid() = user_id);
create policy "vectors_insert" on life_vectors for insert with check (auth.uid() = user_id);
create policy "vectors_update" on life_vectors for update using (auth.uid() = user_id);

-- 3. Decision Simulations
create table if not exists decision_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  scenario_query text not null,
  verdict text not null,
  financial_impact text,
  career_trajectory text,
  personal_wellbeing text,
  success_probability integer, -- 0-100
  tactical_steps jsonb default '[]'::jsonb,
  blindspots jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table decision_simulations enable row level security;
create policy "simulations_select" on decision_simulations for select using (auth.uid() = user_id);
create policy "simulations_insert" on decision_simulations for insert with check (auth.uid() = user_id);
create policy "simulations_delete" on decision_simulations for delete using (auth.uid() = user_id);
