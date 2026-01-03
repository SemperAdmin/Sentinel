-- Migration: Merge Improvements into Todos
-- This script updates the 'todos' table to support rich fields and drops the 'improvements' table.

-- 1. Alter todos table to add new columns
ALTER TABLE todos ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS feedback_summary text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS submitter_name text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS submitter_email text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS effort_estimate text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS impact int;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completion_date timestamptz;

-- 2. Drop constraints if they exist (to allow new status values)
-- Note: Constraint names might vary, so we try to drop them if we can find them, or just alter the column type.
-- The easiest way to remove check constraints in Supabase/Postgres without knowing the exact name is:
ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_priority_check;
ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_status_check;

-- 3. Migrate data from improvements to todos (Optional, if you have data)
-- INSERT INTO todos (id, app_id, title, description, effort_estimate, impact, status, created_at, source)
-- SELECT 
--   id, 
--   app_id, 
--   title, 
--   description, 
--   CAST(effort AS text), -- Convert int effort to text if needed, or map 1->Small, etc.
--   impact, 
--   status, 
--   created_at,
--   'Improvement' as source
-- FROM improvements;

-- 4. Drop improvements table
DROP TABLE IF EXISTS improvements;

-- 5. Drop RLS policies for improvements (if table dropped, policies go with it, but good to be explicit if we kept it)
-- DROP POLICY IF EXISTS "Improvements are viewable by everyone" ON improvements;
