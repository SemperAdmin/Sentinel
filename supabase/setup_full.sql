-- SENTINEL MASTER SETUP SCRIPT
-- Runs all necessary migrations to set up the database for the Sentinel app.
-- Includes: Schema creation (with text IDs), RLS enablement, and Policy setup.

-- 1. CLEANUP (Drop existing tables to start fresh)
drop table if exists ideas;
drop table if exists todos;
drop table if exists improvements;
drop table if exists reviews;
drop table if exists apps;
-- We do NOT drop 'profiles' as it might be linked to Auth. But we reference it.

-- 2. CREATE TABLES

-- Apps (Portfolio Items)
create table apps (
  id text primary key, -- Text ID to support local folder names (e.g. 'eventcall')
  owner_id uuid references auth.users(id), -- Reference auth.users directly or profiles
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

-- Todos (Merged with Improvements)
create table todos (
  id text primary key,
  app_id text references apps(id) on delete cascade,
  title text not null,
  description text,
  priority text, -- check (priority in ('low', 'medium', 'high')) - Removed for flexibility
  status text, -- check (status in ('pending', 'in_progress', 'completed', 'archived')) - Removed for rich statuses
  due_date timestamptz,
  created_at timestamptz default now(),
  
  -- Extended fields for rich todo management & improvements
  source text,
  feedback_summary text,
  submitter_name text,
  submitter_email text,
  effort_estimate text, -- e.g. 'Small', 'Medium', 'Large'
  impact int, -- 1-5 scale
  rejection_reason text,
  completion_date timestamptz
);

-- Ideas
create table ideas (
  id text primary key, -- Text ID to support local file names
  user_id uuid references auth.users(id),
  concept_name text not null,
  problem_solved text,
  target_audience text,
  tech_stack text,
  risk_rating text,
  created_at timestamptz default now()
);

-- 3. ENABLE ROW LEVEL SECURITY
alter table apps enable row level security;
alter table todos enable row level security;
alter table ideas enable row level security;

-- 4. CREATE POLICIES

-- A) Public Read Access (So the app can display data to guests)
create policy "Apps are viewable by everyone" on apps for select using (true);
create policy "Todos are viewable by everyone" on todos for select using (true);
create policy "Ideas are viewable by everyone" on ideas for select using (true);

-- B) Anonymous Write Access (TEMPORARY - For Seeding Data)
-- Allows the seed script to insert data without logging in.
create policy "Allow anonymous insert for apps" on apps for insert with check (true);
create policy "Allow anonymous update for apps" on apps for update using (true);
create policy "Allow anonymous delete for apps" on apps for delete using (true);

create policy "Allow anonymous insert for todos" on todos for insert with check (true);
create policy "Allow anonymous update for todos" on todos for update using (true);
create policy "Allow anonymous delete for todos" on todos for delete using (true);

-- C) Authenticated User Access (For normal app usage)
-- Users can manage their own data (where owner_id matches)
create policy "Users can manage their own apps" on apps for all using (auth.uid() = owner_id);
create policy "Users can manage their own ideas" on ideas for all using (auth.uid() = user_id);

-- 5. STORAGE BUCKETS (Optional, if needed later)
-- insert into storage.buckets (id, name) values ('app-assets', 'app-assets') on conflict do nothing;
