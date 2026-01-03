-- Fix ideas.id to be text to support local file IDs
ALTER TABLE ideas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE ideas ALTER COLUMN id SET DATA TYPE text;
