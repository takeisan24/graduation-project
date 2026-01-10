-- =============================================================================
-- DELETE SCRIPT: Complete Database Cleanup
-- Purpose: Remove all tables, policies, triggers, functions, and indexes
-- Safe to run: Uses IF EXISTS checks, won't fail on missing objects
-- Total Tables: 28 unique tables
-- =============================================================================

-- =============================================================================
-- STEP 1: Drop all RLS policies (if enabled)
-- =============================================================================
do $$
declare
  r record;
begin
  for r in
    select policyname, schemaname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        -- Core Application Tables (11)
        'users','projects','content_drafts','chat_sessions','chat_messages',
        'files','jobs','usage','monthly_usage','subscriptions','credit_transactions',
        -- Social Media Integration (4)
        'connected_accounts','getlate_profiles','getlate_accounts','scheduled_posts',
        'ai_video_projects',
        -- Content Generation (4)

        'niches','content_goals','frameworks','framework_niches',
        -- Video Factory / Server B (9)
        'processing_jobs','media_assets','video_processing_configs',
        'video_factory_projects','video_factory_outputs','video_factory_audio_transcripts',
        'video_factory_job_history',
        'job_steps','external_tasks','global_stock_assets',
        'plans', 'coupons', 'orders', 'coupon_usage', 'payment_logs'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;


-- =============================================================================
-- STEP 2: Drop auth trigger (if exists)
-- =============================================================================
-- Drop auth trigger that provisions public.users and usage (if exists)
do $$
begin
  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created'
      and n.nspname = 'auth'
      and c.relname = 'users'
  ) then
    execute 'drop trigger on_auth_user_created on auth.users';
  end if;
end $$;

-- =============================================================================
-- STEP 3: Drop all triggers on public tables
-- =============================================================================
do $$
declare
  trg record;
begin
  for trg in
    select t.tgname, n.nspname as schemaname, c.relname as tablename
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname in (
        -- Core Application Tables (11)
        'users','projects','content_drafts','chat_sessions','chat_messages',
        'files','jobs','usage','monthly_usage','subscriptions','credit_transactions',
        -- Social Media Integration (4)
        'connected_accounts','getlate_profiles','getlate_accounts','scheduled_posts',
        'ai_video_projects',
        -- Content Generation (4)

        'niches','content_goals','frameworks','framework_niches',
        -- Video Factory / Server B (9)
        'processing_jobs','media_assets','video_processing_configs',
        'video_factory_projects','video_factory_outputs','video_factory_audio_transcripts',
        'job_steps','external_tasks','global_stock_assets',
        'plans', 'coupons', 'orders', 'coupon_usage', 'payment_logs'
      )
  loop
    execute format('drop trigger if exists %I on %I.%I', trg.tgname, trg.schemaname, trg.tablename);
  end loop;
end $$;


-- =============================================================================
-- STEP 4: Drop all functions
-- =============================================================================

-- Core functions
drop function if exists handle_new_auth_user() cascade;
drop function if exists update_updated_at_column() cascade;
drop function if exists increment_usage(uuid, date, text, integer) cascade;
drop function if exists deduct_user_credits(uuid, integer) cascade;
drop function if exists rollback_user_credits(uuid, integer, text, jsonb) cascade;
drop function if exists ensure_user_profile(uuid, text, text, text) cascade;
drop function if exists sync_user_credits_balance(uuid) cascade;
drop function if exists generate_order_number() cascade;
drop function if exists increment_coupon_usage() cascade;
drop function if exists process_monthly_credit_grants() cascade;
drop function if exists set_order_defaults() cascade;
drop function if exists deduct_credits_atomic(uuid, numeric) cascade;
drop function if exists add_credits_atomic(uuid, numeric) cascade;

-- ✅ PRODUCTION-GRADE: Drop RPC functions for DB-based leasing and atomic step updates
drop function if exists claim_external_tasks_for_polling(timestamptz, timestamptz, text, integer) cascade;
drop function if exists patch_step_state(uuid, text, jsonb, text, boolean) cascade;
drop function if exists find_ingest_steps_by_etag(uuid, text, uuid, integer) cascade;

-- ✅ REUSE OPTIMIZATION: Drop atomic translation update function
drop function if exists upsert_translation(uuid, text, jsonb) cascade;

-- ✅ ATOMIC CLIPS: Drop atomic clip update functions (UUID and legacy TEXT signatures)
drop function if exists update_project_output_clip_atomic(uuid, text, jsonb) cascade;
drop function if exists update_project_output_clip_atomic(text, text, jsonb) cascade;
drop function if exists update_project_postprocess_clip_atomic(uuid, text, jsonb) cascade;

-- =============================================================================
-- STEP 5: Drop specific indexes (before dropping tables)
-- =============================================================================
-- ✅ PROJECT-CENTRIC: Drop indexes for project_id and job_subtype
-- Note: These indexes are automatically dropped when tables are dropped (CASCADE)
-- But we explicitly drop them here for clarity and to avoid errors
drop index if exists idx_processing_jobs_project_id;
drop index if exists idx_processing_jobs_project_subtype;
drop index if exists idx_processing_jobs_subtype;
drop index if exists idx_media_assets_project_id;
drop index if exists idx_media_assets_ai_video_project_id;
drop index if exists idx_media_assets_project_type;
drop index if exists idx_media_assets_parent_asset_id;
drop index if exists idx_media_assets_parent_asset_type;
drop index if exists idx_video_factory_outputs_project_id;
drop index if exists idx_video_factory_outputs_project_status;
drop index if exists idx_video_factory_projects_cut_job;
drop index if exists idx_video_factory_projects_processing_job;
drop index if exists idx_video_factory_outputs_parent_cut_clip_id;

-- ✅ FIX: Drop old index on transcript column (causes index size limit error)
drop index if exists idx_video_factory_projects_transcript;

-- ✅ ETAG DEDUPLICATION: Drop GIN index on media_assets.metadata (for ETag lookup)
-- This index was added for content-addressable caching (findByETag performance)
drop index if exists idx_media_assets_metadata_gin;

-- ✅ NEW: Drop unique constraint on job_id for video_factory_projects (if exists)
drop index if exists video_factory_projects_job_id_key;

-- ✅ REUSE OPTIMIZATION: Drop hash-based indexes and unique constraint
drop index if exists idx_video_factory_projects_hashes;
drop index if exists unique_user_source_cut_config;

-- ============================================
-- ✅ TRANSCRIPT REUSE OPTIMIZATION: Drop transcript reuse indexes
-- Date: 2026-01-11
-- Purpose: Clean up performance indexes for transcript reuse
-- ============================================

-- Drop PRIMARY REUSE INDEX (CRITICAL for reuse queries)
drop index if exists idx_video_factory_audio_transcripts_source_media_asset_id;

-- Drop UNIQUE INDEX (enforces one transcript per audio asset)
drop index if exists idx_video_factory_audio_transcripts_audio_media_asset_id;

-- Drop LEGACY indexes (kept for backwards compatibility)
drop index if exists idx_video_factory_audio_transcripts_source_asset;
drop index if exists idx_video_factory_audio_transcripts_audio_asset;

-- Drop OPTIMIZATION indexes
drop index if exists idx_video_factory_audio_transcripts_audio_s3_uri;
drop index if exists idx_video_factory_audio_transcripts_source_transcript;
drop index if exists idx_video_factory_audio_transcripts_created_at;
drop index if exists idx_video_factory_audio_transcripts_source_created;

-- ✅ NEW: Drop soft delete and optimistic locking indexes (Date: 2026-01-13)
drop index if exists uq_source_lang_active;
drop index if exists idx_video_factory_audio_transcripts_version;
drop index if exists idx_processing_jobs_version;
drop index if exists idx_video_factory_projects_version;
drop index if exists idx_media_assets_version;

-- ✅ CRITICAL: Drop unique index on current_processing_job_id (Date: 2026-01-18)
drop index if exists idx_video_factory_projects_current_processing_job_id;

-- =============================================================================
-- STEP 6: Disable Row Level Security (RLS) on all tables
-- =============================================================================
-- Core Application Tables (11)
alter table if exists users disable row level security;
alter table if exists projects disable row level security;
alter table if exists content_drafts disable row level security;
alter table if exists chat_sessions disable row level security;
alter table if exists chat_messages disable row level security;
alter table if exists files disable row level security;
alter table if exists jobs disable row level security;
alter table if exists usage disable row level security;
alter table if exists monthly_usage disable row level security;
alter table if exists subscriptions disable row level security;
alter table if exists credit_transactions disable row level security;

-- Social Media Integration (4)
alter table if exists connected_accounts disable row level security;
alter table if exists getlate_profiles disable row level security;
alter table if exists getlate_accounts disable row level security;
alter table if exists scheduled_posts disable row level security;
alter table if exists ai_video_projects disable row level security;

-- Content Generation (4)

alter table if exists niches disable row level security;
alter table if exists content_goals disable row level security;
alter table if exists frameworks disable row level security;
alter table if exists framework_niches disable row level security;
alter table if exists plans disable row level security;
alter table if exists coupons disable row level security;
alter table if exists orders disable row level security;
alter table if exists coupon_usage disable row level security;
alter table if exists payment_logs disable row level security;

-- Video Factory / Server B (9)
alter table if exists processing_jobs disable row level security;
alter table if exists media_assets disable row level security;
alter table if exists video_processing_configs disable row level security;
alter table if exists video_factory_projects disable row level security;
alter table if exists video_factory_outputs disable row level security;
alter table if exists video_factory_audio_transcripts disable row level security;
alter table if exists video_factory_job_history disable row level security;
alter table if exists job_steps disable row level security;
alter table if exists external_tasks disable row level security;
alter table if exists global_stock_assets disable row level security;


-- =============================================================================
-- STEP 7: Drop all tables
-- ✅ CRITICAL: Drop in reverse dependency order to avoid FK constraint errors
-- Total: 28 unique tables
-- =============================================================================

-- Drop tables in dependency order (reverse specific to general)
drop table if exists payment_logs cascade;
drop table if exists coupon_usage cascade;
drop table if exists orders cascade;

-- Social Media Integration (4 tables)
-- Drop scheduled_posts first (depends on connected_accounts, getlate_profiles, getlate_accounts)
drop table if exists scheduled_posts cascade;
drop table if exists connected_accounts cascade;
drop table if exists getlate_profiles cascade;
drop table if exists getlate_accounts cascade;

-- Core Application Tables (11 tables)
-- Drop dependent tables first
drop table if exists chat_messages cascade;
drop table if exists chat_sessions cascade;
drop table if exists content_drafts cascade;
drop table if exists files cascade;
drop table if exists subscriptions cascade;
drop table if exists usage cascade;
drop table if exists monthly_usage cascade;
drop table if exists credit_transactions cascade;
drop table if exists projects cascade;
drop table if exists jobs cascade;
drop table if exists ai_video_projects cascade;

-- Video Factory / Server B (9 tables)

-- ✅ CRITICAL: Drop in reverse dependency order
-- Dependency chain: video_factory_audio_transcripts → video_factory_projects → processing_jobs → media_assets → video_factory_outputs
-- Drop order: video_factory_outputs → video_processing_configs → external_tasks → job_steps → media_assets → processing_jobs → video_factory_projects → video_factory_audio_transcripts → global_stock_assets
drop table if exists video_factory_outputs cascade;
drop table if exists video_processing_configs cascade;
drop table if exists external_tasks cascade;
drop table if exists job_steps cascade;
drop table if exists media_assets cascade;
drop table if exists video_factory_job_history cascade;
drop table if exists processing_jobs cascade;
drop table if exists video_factory_projects cascade;
drop table if exists video_factory_audio_transcripts cascade;
drop table if exists global_stock_assets cascade;

-- Content Generation (4 tables)
-- Drop framework_niches first (depends on frameworks and niches)
drop table if exists framework_niches cascade;
drop table if exists frameworks cascade;
drop table if exists content_goals cascade;
drop table if exists niches cascade;
drop table if exists coupons cascade;
drop table if exists plans cascade;

-- Core: Drop users last (many tables depend on it)
drop table if exists users cascade;


-- =============================================================================
-- STEP 8: Drop all remaining indexes (cleanup pass)
-- =============================================================================
-- Note: Most indexes are automatically dropped with CASCADE when tables are dropped
-- This is a final cleanup pass for any orphaned indexes

do $$
declare
  idx record;
begin
  for idx in
    select schemaname, tablename, indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename in (
        -- Core Application Tables (11)
        'users','projects','content_drafts','chat_sessions','chat_messages',
        'files','jobs','usage','monthly_usage','subscriptions','credit_transactions',
        -- Social Media Integration (4)
        'connected_accounts','getlate_profiles','getlate_accounts','scheduled_posts',
        'ai_video_projects',
        -- Content Generation (4)

        'niches','content_goals','frameworks','framework_niches',
        'processing_jobs','media_assets','video_processing_configs',
        'video_factory_projects','video_factory_outputs','video_factory_audio_transcripts',
        'job_steps','external_tasks','global_stock_assets',
        'plans', 'coupons', 'orders', 'coupon_usage', 'payment_logs'
      )
      and indexname not like '%_pkey' -- Skip primary keys
  loop
    execute format('drop index if exists %I.%I', idx.schemaname, idx.indexname);
  end loop;
end $$;

-- =============================================================================
-- STEP 9: Drop constraints (if tables still exist)
-- =============================================================================
alter table if exists video_factory_projects drop constraint if exists video_factory_projects_job_id_key;
alter table if exists video_factory_projects drop constraint if exists check_completion_bounds;

-- ✅ NEW: Drop unique constraints on video_factory_outputs to allow multiple outputs per job (One-to-Many)
alter table if exists video_factory_outputs drop constraint if exists video_factory_outputs_postprocess_job_unique;
alter table if exists video_factory_outputs drop constraint if exists video_factory_outputs_postprocess_job_id_key;
alter table if exists video_factory_outputs drop constraint if exists video_factory_outputs_postprocess_job_id_unique;
drop index if exists video_factory_outputs_postprocess_job_unique;
alter table if exists video_factory_outputs drop constraint if exists uq_vfo_job_clip_index;
alter table if exists credit_transactions drop constraint if exists credit_transactions_action_type_check;


-- =============================================================================
-- STEP 10: Optional cleanup
-- =============================================================================
-- ✅ Drop pg_trgm extension if only used by global_stock_assets (optional)
-- Note: Only drop if you're sure no other tables use pg_trgm
-- Uncomment if needed:
-- drop extension if exists pg_trgm;

-- =============================================================================
-- CLEANUP COMPLETE
-- =============================================================================
-- All 28 tables, policies, triggers, functions, indexes, and constraints have been dropped.
-- Database is now clean and ready for fresh schema.sql execution.

-- =============================================================================
-- ✅ VERIFICATION QUERIES (Optional - Run After Cleanup)
-- =============================================================================

-- Verify all tables are dropped:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
--   'users','projects','content_drafts','chat_sessions','chat_messages',
--   'files','jobs','usage','monthly_usage','subscriptions','credit_transactions',
--   'connected_accounts','getlate_profiles','getlate_accounts','scheduled_posts',
--   'niches','content_goals','frameworks','framework_niches',
--   'processing_jobs','media_assets','video_processing_configs',
--   'video_factory_projects','video_factory_outputs','video_factory_audio_transcripts',
--   'job_steps','external_tasks','global_stock_assets'
-- );
-- Expected: 0 rows (all tables dropped)

-- Verify all functions are dropped:
-- SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN (
--   'handle_new_auth_user',
--   'update_updated_at_column',
--   'increment_usage',
--   'deduct_user_credits',
--   'ensure_user_profile',
--   'sync_user_credits_balance',
--   'claim_external_tasks_for_polling',
--   'patch_step_state',
--   'find_ingest_steps_by_etag'
-- );
-- Expected: 0 rows (all functions dropped)

-- Verify all foreign key constraints are dropped:
-- SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
-- Expected: No constraints related to dropped tables

-- =============================================================================
-- ✅ NOTES ON REUSE OPTIMIZATION
-- =============================================================================
-- When re-creating schema, ensure:
-- 1. video_factory_projects.audio_transcript_id uses ON DELETE SET NULL (not CASCADE)
-- 2. video_factory_projects.source_media_asset_id uses ON DELETE SET NULL (not CASCADE)
-- 3. video_factory_audio_transcripts.audio_media_asset_id uses ON DELETE CASCADE
-- 4. video_factory_audio_transcripts.source_media_asset_id uses ON DELETE CASCADE
-- 
-- This ensures:
-- - Multiple projects can share audio/transcript (reuse optimization)
-- - Deleting a project does NOT delete shared resources
-- - Deleting source video DOES cascade delete audio → transcript (cleanup)
-- 
-- See schema.sql for full documentation on CASCADE DELETE BEHAVIOR and WRITE ONCE, READ MANY principle.

-- =============================================================================
-- ✅ ADDITIONAL FEATURES IN SCHEMA
-- =============================================================================
-- The following features are included in schema.sql:
-- 
-- 1. Hash-based Duplicate Detection:
--    - video_factory_projects.source_url_hash (varchar 64)
--    - video_factory_projects.cut_config_hash (varchar 64)
--    - Unique constraint: unique_user_source_cut_config
--    - Index: idx_video_factory_projects_hashes
-- 
-- 2. GIN Index for ETag Deduplication:
--    - idx_media_assets_metadata_gin on media_assets.metadata
--    - Speeds up ETag lookup queries by 10-50x
-- 
-- 3. Atomic Translation Update Function:
--    - upsert_translation(transcript_id, language, segments)
--    - Prevents race conditions in translation updates
--    - Enforces "Write Once, Read Many" principle
-- 
-- 4. Transcript Reuse Optimization (2026-01-11):
--    - 8 performance indexes on video_factory_audio_transcripts
--    - idx_video_factory_audio_transcripts_source_media_asset_id (CRITICAL - 100-1000x faster reuse queries)
--    - idx_video_factory_audio_transcripts_audio_media_asset_id (UNIQUE - prevents duplicates)
--    - Idempotency checks in workers (prevents duplicate transcripts on job retry)
--    - Redis lock service (prevents race conditions on concurrent requests)
--    - Migration script to backfill NULL source_media_asset_id (see JQM/scripts/migrate-null-source-media-asset-id.sql)
--    - Impact: 80-90% cost savings on AWS Transcribe (reuses existing transcripts)
-- 
-- 5. Soft Delete & Optimistic Locking (2026-01-13):
--    - video_factory_audio_transcripts: language column (varchar 10, default 'vi')
--    - video_factory_audio_transcripts: deleted_at column (soft delete support)
--    - Partial unique index: uq_source_lang_active on (source_media_asset_id, language) WHERE deleted_at IS NULL
--    - Version columns on: processing_jobs, video_factory_projects, video_factory_audio_transcripts, media_assets
--    - Version indexes for optimistic locking (prevents lost updates in concurrent scenarios)
--    - Impact: Prevents duplicate transcripts after deletion, prevents lost updates in concurrent workers
-- 
-- 6. Backfill Support:
--    - current_cut_job_id should be backfilled from processing_jobs
--    - See migrations/backfill_current_cut_job_id.sql for details

-- =============================================================================
-- ✅ CRITICAL FK CONSTRAINTS FOR REUSE OPTIMIZATION
-- =============================================================================
-- The following FK constraints are CRITICAL for reuse optimization:
-- 
-- video_factory_projects (preserve project history):
--   - audio_transcript_id → video_factory_audio_transcripts(id) ON DELETE SET NULL
--   - audio_media_asset_id → media_assets(id) ON DELETE SET NULL
--   - source_media_asset_id → media_assets(id) ON DELETE SET NULL
-- 
-- video_factory_audio_transcripts (cascade delete):
--   - audio_media_asset_id → media_assets(id) ON DELETE CASCADE
--   - source_media_asset_id → media_assets(id) ON DELETE CASCADE
-- 
-- media_assets (cascade delete derived assets / preserve project assets):
--   - parent_asset_id → media_assets(id) ON DELETE CASCADE
--   - ai_video_project_id → ai_video_projects(id) ON DELETE SET NULL
-- 
-- To verify FK constraints after schema creation, run:
-- See migrations/verify_fk_constraints_and_create_atomic_translation.sql
-- Expected: All 7 constraints show ✅ CORRECT
-- 
-- ⚠️ KNOWN ISSUE: video_factory_projects.source_media_asset_id may have wrong constraint
-- If verification shows "❌ WRONG - Should be SET NULL" for source_media_asset_id:
--   Problem: Constraint is CASCADE instead of SET NULL
--   Impact: Deleting source video also deletes projects (loses history)
--   Fix: Run migrations/fix_source_media_asset_id_constraint.sql
-- 
-- Quick fix SQL:
--   ALTER TABLE video_factory_projects 
--   DROP CONSTRAINT IF EXISTS video_factory_projects_source_media_asset_id_fkey;
--   ALTER TABLE video_factory_projects 
--   ADD CONSTRAINT video_factory_projects_source_media_asset_id_fkey 
--   FOREIGN KEY (source_media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

-- =============================================================================
-- ✅ TRANSCRIPT REUSE OPTIMIZATION - VERIFICATION AFTER SCHEMA RECREATION
-- Date: 2026-01-11
-- =============================================================================
-- After re-creating schema.sql, verify transcript reuse indexes are working:
-- 
-- 1. Verify Indexes Exist:
--    Run: JQM/scripts/verify-transcript-reuse-indexes.sql
--    Expected: 
--      - source_media_asset_id_index_count: 2 (one partial, one composite)
--      - audio_media_asset_id_index_count: 2 (one unique, one legacy)
--      - deployment_status: "✅ READY FOR PRODUCTION"
-- 
-- 2. Test Index Performance:
--    -- Test source_media_asset_id index
--    EXPLAIN ANALYZE
--    SELECT * FROM video_factory_audio_transcripts 
--    WHERE source_media_asset_id = 'some-uuid';
--    
--    Expected: "Index Scan using idx_video_factory_audio_transcripts_source_media_asset_id"
--    Execution time: < 5ms (for database with < 100K records)
-- 
-- 3. Verify Unique Constraint:
--    -- Try to insert duplicate audio_media_asset_id (should fail)
--    INSERT INTO video_factory_audio_transcripts (audio_media_asset_id, audio_s3_uri)
--    VALUES ('duplicate-uuid', 's3://test/audio.mp3');
--    
--    Expected: ERROR: duplicate key value violates unique constraint
-- 
-- 4. Backfill NULL source_media_asset_id (if needed):
--    Run: JQM/scripts/migrate-null-source-media-asset-id.sql
--    Expected: NULL records backfilled from media_assets.parent_asset_id
--    Verify: SELECT COUNT(*) FROM video_factory_audio_transcripts WHERE source_media_asset_id IS NULL;
--    Expected: 0 (or minimal orphaned records)
-- 
-- 5. Monitor Reuse Rate (Production):
--    -- Check transcript reuse effectiveness
--    SELECT 
--      COUNT(DISTINCT source_media_asset_id) AS unique_videos,
--      COUNT(*) AS total_projects,
--      ROUND((COUNT(*) - COUNT(DISTINCT source_media_asset_id)) * 100.0 / COUNT(*), 2) AS reuse_percentage
--    FROM video_factory_projects
--    WHERE audio_transcript_id IS NOT NULL;
--    
--    Expected: reuse_percentage > 10% (indicates successful reuse)
--    
-- =============================================================================
-- ✅ KNOWN ISSUES AND SOLUTIONS
-- =============================================================================
-- 
-- ISSUE #1: Slow Reuse Queries (> 100ms)
--   Symptom: Worker logs show "Transcript reuse check took > 100ms"
--   Cause: Missing or unused index on source_media_asset_id
--   Solution: Run ANALYZE video_factory_audio_transcripts; to update query planner stats
--   Verify: EXPLAIN should show "Index Scan" not "Seq Scan"
-- 
-- ISSUE #2: High NULL source_media_asset_id Count
--   Symptom: Reuse queries return 0 results even though transcripts exist
--   Cause: Old transcripts created before migration have NULL source_media_asset_id
--   Solution: Run JQM/scripts/migrate-null-source-media-asset-id.sql
--   Impact: After migration, reuse rate should increase by 50-80%
-- 
-- ISSUE #3: Duplicate Transcript Creation
--   Symptom: Same source video has multiple transcripts in database
--   Cause: Race condition or missing idempotency check in worker
--   Solution: Check handleAudioExtractCompletion() has findLinkedAudio() check
--   Verify: SELECT source_media_asset_id, COUNT(*) FROM video_factory_audio_transcripts 
--           GROUP BY source_media_asset_id HAVING COUNT(*) > 1;
--   Expected: 0 rows (no duplicates)
-- 
-- ISSUE #4: Orphaned Transcripts (NULL source_media_asset_id after migration)
--   Symptom: Migration query shows "without_source_id" count > 0
--   Cause: Audio asset missing parent_asset_id or parent video deleted
--   Solution: Manual investigation or delete orphaned records:
--     DELETE FROM video_factory_audio_transcripts 
--     WHERE source_media_asset_id IS NULL 
--     AND created_at < NOW() - INTERVAL '30 days';
-- 
-- =============================================================================