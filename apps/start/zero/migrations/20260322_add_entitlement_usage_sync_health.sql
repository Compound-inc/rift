ALTER TABLE org_entitlement_snapshot
  ADD COLUMN IF NOT EXISTS usage_sync_status TEXT NOT NULL DEFAULT 'ok';

ALTER TABLE org_entitlement_snapshot
  ADD COLUMN IF NOT EXISTS usage_sync_error TEXT;
