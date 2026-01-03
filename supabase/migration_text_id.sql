-- Migration to change ID to text to support legacy app IDs
-- Run this in Supabase SQL Editor

-- 1. Drop dependent tables first (cascade would be dangerous if we had data, but we are setting up)
drop table if exists todos;
drop table if exists improvements;
drop table if exists apps;

-- 2. Re-create Apps with TEXT id
create table apps (
  id text primary key, -- Changed from uuid to text
  owner_id uuid references profiles(id),
  repo_url text,
  name text,
  platform text,
  status text,
  description text,
  github_stats jsonb default '{}'::jsonb,
  last_review_date timestamptz,
  next_review_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Re-create Todos
create table todos (
  id uuid default gen_random_uuid() primary key,
  app_id text references apps(id) on delete cascade, -- Changed to text
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high')),
  status text check (status in ('pending', 'in_progress', 'completed', 'archived')),
  due_date timestamptz,
  created_at timestamptz default now()
);

-- 4. Re-create Improvements
create table improvements (
  id uuid default gen_random_uuid() primary key,
  app_id text references apps(id) on delete cascade, -- Changed to text
  title text not null,
  description text,
  effort int check (effort between 1 and 5),
  impact int check (impact between 1 and 5),
  status text default 'pending',
  created_at timestamptz default now()
);

-- 5. Re-enable RLS
alter table apps enable row level security;
alter table todos enable row level security;
alter table improvements enable row level security;

-- 6. Re-apply Policies
create policy "Apps are viewable by authenticated users" 
on apps for select 
using ( auth.role() = 'authenticated' or auth.role() = 'anon' ); -- Added anon for dev

create policy "Admins and Owners can insert apps" 
on apps for insert 
with check ( true ); -- Relaxed for seeding, tighten later

create policy "Admins and Owners can update apps" 
on apps for update 
using ( true ); -- Relaxed for seeding, tighten later

create policy "Admins and Owners can delete apps" 
on apps for delete 
using ( true ); -- Relaxed for seeding, tighten later

-- Todos policies
create policy "Todos viewable by everyone" on todos for select using (true);
create policy "Todos editable by everyone" on todos for all using (true);

-- Improvements policies
create policy "Improvements viewable by everyone" on improvements for select using (true);
create policy "Improvements editable by everyone" on improvements for all using (true);
