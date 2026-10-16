-- ============================================================================
-- CobraLearn Orbit — Dedicated Rate-Limiting Storage Initialization
-- Target Table: _orbit_rate_limits
-- Target Database: PostgreSQL (Supabase / AWS ap-south-1)
--
-- IMPORTANT SAFETY NOTICE:
-- This script is reviewable and idempotent. It creates the table and index
-- only if they do not already exist. It does NOT drop, truncate, or modify
-- any existing tables, constraints, or production records.
--
-- DO NOT EXECUTE THIS SCRIPT AUTOMATICALLY.
-- Run manually via Supabase Dashboard SQL Editor or direct psql admin connection
-- prior to routing live traffic to the production portal.
-- ============================================================================

-- 1. Create the rate-limiting key-value bucket table
CREATE TABLE IF NOT EXISTS "_orbit_rate_limits" (
    "key" VARCHAR(128) PRIMARY KEY,
    "count" INT NOT NULL DEFAULT 1,
    "reset_at" TIMESTAMPTZ NOT NULL
);

-- 2. Create the index for sliding window reset lookups and bounded pruning
CREATE INDEX IF NOT EXISTS "_orbit_rate_limits_reset_at_idx"
    ON "_orbit_rate_limits" ("reset_at");

-- ============================================================================
-- Read-Only Verification Queries (Run after execution to confirm success):
--
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = '_orbit_rate_limits'
-- ORDER BY ordinal_position;
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = '_orbit_rate_limits';
-- ============================================================================
