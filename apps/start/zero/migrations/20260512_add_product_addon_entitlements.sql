-- Adds platform-granted product addon entitlements to the org entitlement
-- snapshot. The column is a flat map keyed by entitlement id
-- (e.g. "hr", "hr.recruitment") → boolean. Defaults to an empty object so
-- existing rows remain valid while the billing recompute populates real
-- values over time.
--
-- See apps/start/PRODUCTS_AND_ADDONS.md for the full pattern.

ALTER TABLE org_entitlement_snapshot
ADD COLUMN IF NOT EXISTS product_addon_entitlements JSONB NOT NULL DEFAULT '{}'::jsonb;
