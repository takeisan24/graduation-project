-- UNIVERSAL RLS DISABLER & PERMISSION GRANT SCRIPT
-- ==============================================================================
-- DESCRIPTION:
-- This utility script allows you to "Unlock" the entire database for development.
-- It dynamically iterates through ALL tables in the 'public' schema to:
-- 1. DISABLE Row Level Security (RLS).
-- 2. DROP all existing Policies.
-- 3. GRANT full permissions to 'anon' and 'authenticated' roles.
--
-- EXECUTION:
-- Run this in the Supabase SQL Editor.
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. DISABLE ROW LEVEL SECURITY ON ALL TABLE
    -- Loop through all tables in 'public' schema and disable RLS
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
        RAISE NOTICE 'Disabled RLS on table: %', r.tablename;
    END LOOP;

    -- 2. DROP ALL EXISTING POLICIES
    -- Loop through all policies in 'public' schema and drop them
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
        RAISE NOTICE 'Dropped policy: % on table: %', r.policyname, r.tablename;
    END LOOP;

    -- 3. GRANT PERMISSIONS (Dev Mode)
    
    -- Grant Usage on Schema
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    
    -- Grant ALL on Tables (Select/Insert/Update/Delete)
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; -- Ensure service_role has access too

    -- Grant ALL on Sequences (for auto-increment IDs)
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

    RAISE NOTICE 'SUCCESS: All tables are now open access (RLS Disabled, Policies Dropped, Grants Applied).';
    
END $$;
