-- Migration: Add input_snapshot column for video_factory_projects
-- Purpose:
--   - Support background processing & worker recovery for postprocess/cut steps
--   - Store a JSON snapshot of the input data when a job starts
-- Context:
--   - Application code already reads/writes video_factory_projects.input_snapshot (JSONB)
--   - Without this column, Supabase/PostgREST returns:
--       PGRST204: Could not find the 'input_snapshot' column of 'video_factory_projects'
--   - This migration brings the database schema in line with the repository types.

-- Step 1: Add input_snapshot column if missing
ALTER TABLE video_factory_projects
ADD COLUMN IF NOT EXISTS input_snapshot JSONB;

-- Step 2: Optional comment for documentation
COMMENT ON COLUMN video_factory_projects.input_snapshot IS
'Snapshot of input data (clips, transcript, configs, etc.) when a processing job starts, used for worker recovery and background processing.';


