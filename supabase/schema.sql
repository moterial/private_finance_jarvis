-- ============================================
-- JARVIS Finance — Supabase Database Setup
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================

-- 1. Portfolio positions
create table if not exists portfolios (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  shares numeric not null default 0,
  avg_cost numeric not null default 0,
  notes text default '',
  added_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, ticker)
);

alter table portfolios enable row level security;

create policy "Users can view own portfolio"
  on portfolios for select
  using (auth.uid() = user_id);

create policy "Users can insert own portfolio"
  on portfolios for insert
  with check (auth.uid() = user_id);

create policy "Users can update own portfolio"
  on portfolios for update
  using (auth.uid() = user_id);

create policy "Users can delete own portfolio"
  on portfolios for delete
  using (auth.uid() = user_id);

-- 2. Watchlist
create table if not exists watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  added_at timestamptz default now(),
  unique(user_id, ticker)
);

alter table watchlist enable row level security;

create policy "Users can view own watchlist"
  on watchlist for select using (auth.uid() = user_id);
create policy "Users can insert own watchlist"
  on watchlist for insert with check (auth.uid() = user_id);
create policy "Users can delete own watchlist"
  on watchlist for delete using (auth.uid() = user_id);

-- 3. Trade journal entries
create table if not exists trade_journal (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  action text not null check (action in ('buy', 'sell', 'short', 'cover')),
  price numeric not null,
  shares numeric not null,
  date date not null,
  reasoning text default '',
  emotion text default 'neutral' check (emotion in ('confident', 'fearful', 'greedy', 'neutral', 'fomo')),
  outcome text default 'open' check (outcome in ('win', 'loss', 'open')),
  pnl numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table trade_journal enable row level security;

create policy "Users can view own journal"
  on trade_journal for select using (auth.uid() = user_id);
create policy "Users can insert own journal"
  on trade_journal for insert with check (auth.uid() = user_id);
create policy "Users can update own journal"
  on trade_journal for update using (auth.uid() = user_id);
create policy "Users can delete own journal"
  on trade_journal for delete using (auth.uid() = user_id);

-- 4. Alert rules
create table if not exists alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  condition text not null check (condition in ('price_above', 'price_below', 'change_above', 'change_below', 'sentiment_shift')),
  value numeric not null,
  enabled boolean default true,
  triggered boolean default false,
  created_at timestamptz default now()
);

alter table alerts enable row level security;

create policy "Users can view own alerts"
  on alerts for select using (auth.uid() = user_id);
create policy "Users can insert own alerts"
  on alerts for insert with check (auth.uid() = user_id);
create policy "Users can update own alerts"
  on alerts for update using (auth.uid() = user_id);
create policy "Users can delete own alerts"
  on alerts for delete using (auth.uid() = user_id);

-- 5. AI cache (shared across all users to reduce token consumption)
create table if not exists ai_cache (
  cache_key text primary key,
  response jsonb not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Public read for cache (no RLS needed — it's shared)
alter table ai_cache enable row level security;

create policy "Anyone can read cache"
  on ai_cache for select using (true);
create policy "Service can write cache"
  on ai_cache for insert with check (true);
create policy "Service can update cache"
  on ai_cache for update using (true);
create policy "Service can delete cache"
  on ai_cache for delete using (true);

-- Auto-cleanup expired cache entries
create or replace function cleanup_expired_cache()
returns void as $$
begin
  delete from ai_cache where expires_at < now();
end;
$$ language plpgsql;

-- Index for faster cache lookups
create index if not exists idx_ai_cache_expires on ai_cache(expires_at);
create index if not exists idx_portfolios_user on portfolios(user_id);
create index if not exists idx_journal_user on trade_journal(user_id);
create index if not exists idx_alerts_user on alerts(user_id);
create index if not exists idx_watchlist_user on watchlist(user_id);

-- 6. Portfolio daily history (snapshots for performance chart)
create table if not exists portfolio_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  total_value numeric not null default 0,
  total_cost numeric not null default 0,
  day_pnl numeric not null default 0,
  positions_json jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table portfolio_history enable row level security;

create policy "Users can view own history"
  on portfolio_history for select using (auth.uid() = user_id);
create policy "Users can insert own history"
  on portfolio_history for insert with check (auth.uid() = user_id);
create policy "Users can update own history"
  on portfolio_history for update using (auth.uid() = user_id);

create index if not exists idx_portfolio_history_user_date on portfolio_history(user_id, date desc);
