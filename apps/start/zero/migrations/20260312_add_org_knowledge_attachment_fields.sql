ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS org_knowledge_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS active_org_knowledge_count BIGINT NOT NULL DEFAULT 0;

ALTER TABLE attachments
ADD COLUMN IF NOT EXISTS org_knowledge_kind TEXT;

ALTER TABLE attachments
ADD COLUMN IF NOT EXISTS org_knowledge_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS attachments_org_knowledge_lookup
  ON attachments (owner_org_id, org_knowledge_kind, org_knowledge_active, status, updated_at DESC);
