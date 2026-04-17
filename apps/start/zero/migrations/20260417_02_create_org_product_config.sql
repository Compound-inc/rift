CREATE TABLE IF NOT EXISTS org_product_config (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  feature_states JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS org_product_config_organization_id
  ON org_product_config (organization_id);

CREATE INDEX IF NOT EXISTS org_product_config_updated_at
  ON org_product_config (updated_at);
