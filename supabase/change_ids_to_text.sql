-- Migration to change App IDs from UUID to TEXT
-- This allows using the existing string IDs (e.g. "eventcall") from the JSON data.

-- 1. Drop dependent tables
drop table if exists todos;
drop table if exists improvements;
drop table if exists reviews; -- In case it exists
drop table if exists apps;

-- 2. Recreate Apps table with TEXT ID
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

-- 3. Recreate dependent tables with TEXT references
create table todos (
  id text primary key, -- Changed to text to support timestamp IDs
  app_id text references apps(id) on delete cascade,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high')),
  status text check (status in ('pending', 'in_progress', 'completed', 'archived')),
  due_date timestamptz,
  created_at timestamptz default now()
);

create table improvements (
  id text primary key, -- Changed to text
  app_id text references apps(id) on delete cascade,
  title text not null,
  description text,
  effort int check (effort between 1 and 5),
  impact int check (impact between 1 and 5),
  status text default 'pending',
  created_at timestamptz default now()
);

-- 4. Enable RLS
alter table apps enable row level security;
alter table todos enable row level security;
alter table improvements enable row level security;

-- 5. Re-apply Policies

-- Apps Policies
create policy "Apps are viewable by authenticated users" 
on apps for select using ( auth.role() = 'authenticated' );

create policy "Admins and Owners can insert apps" 
on apps for insert 
with check ( 
  exists (select 1 from profiles where id = auth.uid() and role = 'admin') or 
  auth.uid() = owner_id 
);

create policy "Admins and Owners can update apps" 
on apps for update 
using ( 
  exists (select 1 from profiles where id = auth.uid() and role = 'admin') or 
  auth.uid() = owner_id 
);

create policy "Admins and Owners can delete apps" 
on apps for delete 
using ( 
  exists (select 1 from profiles where id = auth.uid() and role = 'admin') or 
  auth.uid() = owner_id 
);

-- Todos Policies
create policy "Todos are viewable by authenticated users" 
on todos for select using ( auth.role() = 'authenticated' );

create policy "Admins and Owners can manage todos" 
on todos for all 
using ( 
  exists (select 1 from apps where id = todos.app_id and (
    owner_id = auth.uid() or 
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  ))
);

-- Improvements Policies
create policy "Improvements are viewable by authenticated users" 
on improvements for select using ( auth.role() = 'authenticated' );

create policy "Admins and Owners can manage improvements" 
on improvements for all 
using ( 
  exists (select 1 from apps where id = improvements.app_id and (
    owner_id = auth.uid() or 
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  ))
);
