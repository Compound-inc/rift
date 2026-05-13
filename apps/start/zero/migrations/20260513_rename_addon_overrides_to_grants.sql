-- Migrates `org_subscription.metadata.addonOverrides` to the canonical
-- `addonGrants` key. Post-this-migration the coercer no longer reads the
-- legacy key, so any row that still carries only `addonOverrides` would be
-- silently ignored and effectively lose its grants.
--
-- Strategy:
-- 1. For rows that carry only `addonOverrides`, copy the object into
--    `addonGrants`.
-- 2. For rows that carry both keys, prefer the newer `addonGrants` blob
--    (writes after the rename) and drop the legacy one.
-- 3. Unconditionally strip the legacy key from every affected row so the
--    metadata shape is canonical.
--
-- See apps/start/PRODUCTS_AND_ADDONS.md §3 / §8 for the canonical model.

UPDATE org_subscription
SET metadata = (
  CASE
    -- Both keys present → keep canonical, drop legacy.
    WHEN metadata ? 'addonGrants' THEN
      (metadata - 'addonOverrides')
    -- Only legacy present → copy under the canonical key, then drop it.
    ELSE
      jsonb_set(
        metadata - 'addonOverrides',
        '{addonGrants}',
        metadata -> 'addonOverrides',
        true
      )
  END
),
updated_at = EXTRACT(EPOCH FROM now()) * 1000
WHERE metadata ? 'addonOverrides';
