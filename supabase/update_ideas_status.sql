
-- Add status column to ideas table
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Update existing rows to have pending status if null
UPDATE ideas SET status = 'pending' WHERE status IS NULL;

-- Add check constraint for valid statuses
-- We allow 'pending', 'implemented', 'rejected'
ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_status_check;
ALTER TABLE ideas ADD CONSTRAINT ideas_status_check CHECK (status IN ('pending', 'implemented', 'rejected'));
