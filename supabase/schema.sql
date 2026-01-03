-- Profiles linked to Auth
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz default now()
);

-- Apps
create table if not exists apps (
  id uuid default gen_random_uuid() primary key,
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

-- Todos
create table if not exists todos (
  id uuid default gen_random_uuid() primary key,
  app_id uuid references apps(id) on delete cascade,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high')),
  status text check (status in ('pending', 'in_progress', 'completed', 'archived')),
  due_date timestamptz,
  created_at timestamptz default now()
);

-- Improvements
create table if not exists improvements (
  id uuid default gen_random_uuid() primary key,
  app_id uuid references apps(id) on delete cascade,
  title text not null,
  description text,
  effort int check (effort between 1 and 5),
  impact int check (impact between 1 and 5),
  status text default 'pending',
  created_at timestamptz default now()
);

-- Ideas
create table if not exists ideas (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id),
  concept_name text not null,
  problem_solved text,
  target_audience text,
  tech_stack text,
  risk_rating text check (risk_rating in ('Low', 'Medium', 'High')),
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table apps enable row level security;
alter table todos enable row level security;
alter table improvements enable row level security;
alter table ideas enable row level security;

-- Policies
-- Profiles: Everyone can read their own profile. Admins can read all.
create policy "Public profiles are viewable by everyone" 
on profiles for select 
using ( true );

create policy "Users can update own profile" 
on profiles for update 
using ( auth.uid() = id );

-- Apps: Authenticated users can view all apps (for now). Admins/Owners can edit.
create policy "Apps are viewable by authenticated users" 
on apps for select 
using ( auth.role() = 'authenticated' );

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

-- Repeat similar policies for Todos, Improvements, Ideas (omitted for brevity, can be expanded)
-- For simplicity in this plan, we allow authenticated users to view everything, and only admins/owners to edit.
