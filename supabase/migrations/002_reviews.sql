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
