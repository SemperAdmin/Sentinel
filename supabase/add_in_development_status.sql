
-- Update check constraint to include 'in_development'
ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_status_check;
ALTER TABLE ideas ADD CONSTRAINT ideas_status_check CHECK (status IN ('pending', 'in_development', 'implemented', 'rejected'));
