-- Run this in your Supabase SQL editor to set up the database

-- Users table (mirrors Clerk but adds Stripe + access control)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique,
  email text not null unique,
  name text,
  has_access boolean default false,
  stripe_customer_id text unique,
  created_at timestamptz default now()
);

-- Brand progress per tool per user
create table if not exists public.brand_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(clerk_id) on delete cascade,
  tool text not null check (tool in ('vision', 'value', 'voice', 'visuals', 'visibility')),
  completed boolean default false,
  messages jsonb default '[]'::jsonb,
  summary text,
  updated_at timestamptz default now(),
  unique(user_id, tool)
);

-- RLS policies
alter table public.users enable row level security;
alter table public.brand_progress enable row level security;

-- Users can only read/update their own record
create policy "Users read own record" on public.users
  for select using (clerk_id = auth.uid()::text);

create policy "Users update own record" on public.users
  for update using (clerk_id = auth.uid()::text);

-- Brand progress: users manage their own rows
create policy "Users manage own progress" on public.brand_progress
  for all using (user_id = auth.uid()::text);

-- Service role bypasses RLS (used by webhook + server actions)
-- No policy needed — service role key bypasses all RLS
