-- ============================================
-- DIAGNOSTIC: Check todo-app relationships
-- Run this first to see the current state
-- ============================================

-- 1. List all todos with their associated app_id and app name
SELECT
    t.id as todo_id,
    t.title as todo_title,
    t.app_id,
    a.name as app_name,
    a.repo_url
FROM todos t
LEFT JOIN apps a ON t.app_id = a.id
ORDER BY t.app_id, t.title;

-- 2. Count todos per app
SELECT
    a.id as app_id,
    a.name as app_name,
    COUNT(t.id) as todo_count
FROM apps a
LEFT JOIN todos t ON a.id = t.app_id
GROUP BY a.id, a.name
ORDER BY todo_count DESC;

-- 3. Find any orphaned todos (todos with no matching app)
SELECT
    t.id as todo_id,
    t.title,
    t.app_id as orphan_app_id
FROM todos t
LEFT JOIN apps a ON t.app_id = a.id
WHERE a.id IS NULL;

-- ============================================
-- FIX: Move todos from one app to another
-- Uncomment and modify as needed
-- ============================================

-- Example: Move all todos from 'naval-letter-formatter' to 'eventcall' (FIX THIS IF NEEDED)
-- UPDATE todos
-- SET app_id = 'naval-letter-formatter'
-- WHERE app_id = 'eventcall'
--   AND title LIKE '%letter%';  -- Add conditions to identify which todos to move

-- Example: Move specific todo by ID
-- UPDATE todos
-- SET app_id = 'correct-app-id-here'
-- WHERE id = 'specific-todo-id';

-- ============================================
-- CLEANUP: Delete all todos for a specific app (USE WITH CAUTION)
-- ============================================

-- DELETE FROM todos WHERE app_id = 'app-id-here';

-- ============================================
-- VERIFY: Check specific apps
-- ============================================

-- Check todos for eventcall
SELECT * FROM todos WHERE app_id = 'eventcall';

-- Check todos for naval-letter-formatter
SELECT * FROM todos WHERE app_id = 'naval-letter-formatter';

-- List all app IDs
SELECT id, name FROM apps ORDER BY name;
