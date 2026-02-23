-- Organization-scoped AI model policy table.
-- Designed to avoid row explosion as the catalog grows.

CREATE TABLE IF NOT EXISTS org_ai_policy (
  id TEXT PRIMARY KEY,
  org_workos_id TEXT NOT NULL UNIQUE,
  disabled_provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  disabled_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  compliance_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS org_ai_policy_org_workos_id
  ON org_ai_policy (org_workos_id);

CREATE INDEX IF NOT EXISTS org_ai_policy_updated_at
  ON org_ai_policy (updated_at);
