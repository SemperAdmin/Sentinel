-- fix_ideas_rls.sql
-- Run this script in the Supabase SQL Editor to fix permission issues.

-- 1. Ensure profiles table exists and handles permissions
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Profiles policies
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone" on profiles for select using ( true );

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using ( auth.uid() = id );

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile" on profiles for insert with check ( auth.uid() = id );

-- 2. Ideas Table Policies
alter table ideas enable row level security;

-- Allow everyone to read ideas
drop policy if exists "Anyone can read ideas" on ideas;
create policy "Anyone can read ideas" on ideas for select using ( true );

-- Allow everyone to insert ideas (for public submissions)
drop policy if exists "Anyone can insert ideas" on ideas;
create policy "Anyone can insert ideas" on ideas for insert with check ( true );

-- Allow ADMINS to update any idea
drop policy if exists "Admins can update any idea" on ideas;
create policy "Admins can update any idea" on ideas for update using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- Allow ADMINS to delete any idea
drop policy if exists "Admins can delete any idea" on ideas;
create policy "Admins can delete any idea" on ideas for delete using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 3. AUTO-GRANT ADMIN TO ALL EXISTING USERS (Dev Helper)
-- This ensures that if you are already signed up, you become an admin.
insert into profiles (id, email, role)
select id, email, 'admin' from auth.users
on conflict (id) do update set role = 'admin';

-- 4. Verify admin status
do $$
declare
  admin_count int;
begin
  select count(*) into admin_count from profiles where role = 'admin';
  raise notice 'Number of admins currently in system: %', admin_count;
end $$;
