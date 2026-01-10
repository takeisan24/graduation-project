-- 2026-03-11
-- Deduplicate media_assets rows for the same physical file
-- and enforce uniqueness on storage_key to prevent future duplicates.
--
-- Scope:
-- - Applies to ALL media types that use storage_key (video/image/audio),
--   but the primary motivation is to ensure each cut clip (Video Factory)
--   only has a single media_assets row per storage_key.

begin;

-- 1) Deduplicate existing rows by storage_key.
--    Rule: keep the smallest id (oldest row) for each storage_key, delete the rest.
--    This is conservative and does not try to be clever about metadata differences;
--    the goal is to guarantee 1:1 mapping between S3 object and media_assets row.
with dupes as (
  select
    storage_key,
    -- Some Postgres setups don't support min(uuid) directly; cast to text for aggregation.
    (min(id::text))::uuid as keep_id,
    array_agg(id order by created_at) as all_ids,
    count(*) as cnt
  from media_assets
  where storage_key is not null
  group by storage_key
  having count(*) > 1
)
delete from media_assets m
using dupes d
where m.storage_key = d.storage_key
  and m.id <> d.keep_id;

-- 2) Enforce uniqueness on storage_key at the database level.
--    This guarantees that:
--    - JQM's saveMediaAssetSafe (which already checks storage_key) remains safe under race conditions.
--    - Webhooks using UPSERT ... ON CONFLICT (storage_key) behave as intended.
create unique index if not exists media_assets_storage_key_unique
  on media_assets (storage_key)
  where storage_key is not null;

commit;

