-- CLEANUP SECURITY: Remove temporary anonymous write access
-- Run this in Supabase SQL Editor AFTER you have confirmed the app is seeded.

-- Remove Anon Access from Apps
drop policy if exists "Allow anonymous insert for apps" on apps;
drop policy if exists "Allow anonymous update for apps" on apps;
drop policy if exists "Allow anonymous delete for apps" on apps;

-- Remove Anon Access from Todos
drop policy if exists "Allow anonymous insert for todos" on todos;
drop policy if exists "Allow anonymous update for todos" on todos;
drop policy if exists "Allow anonymous delete for todos" on todos;

-- Remove Anon Access from Improvements
drop policy if exists "Allow anonymous insert for improvements" on improvements;
drop policy if exists "Allow anonymous update for improvements" on improvements;
drop policy if exists "Allow anonymous delete for improvements" on improvements;
