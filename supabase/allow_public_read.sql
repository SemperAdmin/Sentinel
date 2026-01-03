-- ALLOW PUBLIC READ ACCESS
-- Run this in your Supabase SQL Editor to let the app load data without being logged in.

-- 1. Apps
drop policy if exists "Apps are viewable by authenticated users" on apps;
create policy "Apps are viewable by everyone" 
on apps for select 
using ( true );

-- 2. Todos
-- Drop potential existing policies to be safe
drop policy if exists "Todos are viewable by authenticated users" on todos; 
create policy "Todos are viewable by everyone" 
on todos for select 
using ( true );

-- 3. Improvements
drop policy if exists "Improvements are viewable by authenticated users" on improvements;
create policy "Improvements are viewable by everyone" 
on improvements for select 
using ( true );

-- 4. Ideas
drop policy if exists "Ideas are viewable by authenticated users" on ideas;
create policy "Ideas are viewable by everyone" 
on ideas for select 
using ( true );
