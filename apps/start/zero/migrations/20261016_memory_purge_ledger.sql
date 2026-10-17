-- Privacy deletion targets deliberately have no foreign keys to auth/chat rows.
-- They must survive cascades, missing credentials, and application crashes.
CREATE TABLE IF NOT EXISTS memory_namespaces (
  namespace TEXT PRIMARY KEY,
  user_id TEXT,
  organization_id TEXT,
  generation TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'purge_pending', 'purged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  purge_attempts INTEGER NOT NULL DEFAULT 0,
  purge_passes INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_purge_error TEXT,
  purged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS memory_namespaces_status_due ON memory_namespaces (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS memory_namespaces_org_user ON memory_namespaces (organization_id, user_id);
CREATE INDEX IF NOT EXISTS memory_namespaces_user ON memory_namespaces (user_id);
CREATE INDEX IF NOT EXISTS user_memory_preference_organization ON user_memory_preference (organization_id);

CREATE TABLE IF NOT EXISTS memory_documents (
  namespace TEXT NOT NULL,
  document_id TEXT NOT NULL,
  thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'purge_pending', 'purged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  purge_attempts INTEGER NOT NULL DEFAULT 0,
  purge_passes INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_purge_error TEXT,
  purged_at TIMESTAMPTZ,
  PRIMARY KEY (namespace, document_id)
);
CREATE INDEX IF NOT EXISTS memory_documents_status_due ON memory_documents (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS memory_documents_thread ON memory_documents (thread_id);

-- A 30s drain exceeds the 10s detached-save and 8s vendor HTTP deadlines.
-- The worker repeats deletion at least 30s later before marking a target purged.
CREATE OR REPLACE FUNCTION queue_memory_scope_purge() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE memory_namespaces SET status = 'purge_pending', retired_at = NOW(),
    next_attempt_at = NOW() + INTERVAL '30 seconds', purge_passes = 0
  WHERE status <> 'purged' AND
    CASE TG_TABLE_NAME
      WHEN 'member' THEN user_id = to_jsonb(OLD)->>'userId' AND organization_id = to_jsonb(OLD)->>'organizationId'
      WHEN 'user' THEN user_id = to_jsonb(OLD)->>'id'
      WHEN 'organization' THEN organization_id = to_jsonb(OLD)->>'id'
    END;
  IF TG_TABLE_NAME = 'member' THEN
    -- Rejoining never restores a removed member's old generation or consent.
    UPDATE user_memory_preference SET enabled = FALSE, generation = gen_random_uuid()::TEXT,
      retired_generations = '[]'::JSONB, updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    WHERE user_id = OLD."userId" AND organization_id = OLD."organizationId";
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS memory_member_removal ON member;
CREATE TRIGGER memory_member_removal BEFORE DELETE ON member FOR EACH ROW EXECUTE FUNCTION queue_memory_scope_purge();
DROP TRIGGER IF EXISTS memory_user_deletion ON "user";
CREATE TRIGGER memory_user_deletion BEFORE DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION queue_memory_scope_purge();
DROP TRIGGER IF EXISTS memory_organization_deletion ON organization;
CREATE TRIGGER memory_organization_deletion BEFORE DELETE ON organization FOR EACH ROW EXECUTE FUNCTION queue_memory_scope_purge();

CREATE OR REPLACE FUNCTION queue_memory_document_purge() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE memory_documents SET status = 'purge_pending', retired_at = NOW(),
    next_attempt_at = NOW() + INTERVAL '30 seconds', purge_passes = 0
  WHERE status <> 'purged' AND thread_id = OLD.thread_id
    AND (TG_TABLE_NAME = 'threads' OR document_id = 'turn:' || (to_jsonb(OLD)->>'message_id'));
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS memory_message_deletion ON messages;
CREATE TRIGGER memory_message_deletion BEFORE DELETE ON messages FOR EACH ROW EXECUTE FUNCTION queue_memory_document_purge();
DROP TRIGGER IF EXISTS memory_thread_deletion ON threads;
CREATE TRIGGER memory_thread_deletion BEFORE DELETE ON threads FOR EACH ROW EXECUTE FUNCTION queue_memory_document_purge();

-- Completed tombstones reject stale registrations without retaining raw identities.
ALTER TABLE memory_namespaces ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN organization_id DROP NOT NULL, ALTER COLUMN generation DROP NOT NULL;
ALTER TABLE memory_documents ALTER COLUMN thread_id DROP NOT NULL;
UPDATE memory_namespaces SET user_id = NULL, organization_id = NULL, generation = NULL WHERE status = 'purged';
UPDATE memory_documents SET thread_id = NULL WHERE status = 'purged';
