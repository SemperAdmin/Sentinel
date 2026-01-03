-- MIGRATION: Unify Improvements into Todos
-- 1. Add effort/impact columns to todos
ALTER TABLE todos ADD COLUMN IF NOT EXISTS effort int CHECK (effort between 1 and 5);
ALTER TABLE todos ADD COLUMN IF NOT EXISTS impact int CHECK (impact between 1 and 5);

-- 2. Migrate existing improvements to todos
INSERT INTO todos (id, app_id, title, description, status, created_at, effort, impact)
SELECT 
    id, 
    app_id, 
    title, 
    description, 
    CASE 
        WHEN status = 'completed' THEN 'completed'
        WHEN status = 'in_progress' THEN 'in_progress'
        ELSE 'pending'
    END as status,
    created_at, 
    effort, 
    impact
FROM improvements;

-- 3. Drop improvements table
DROP TABLE improvements;
