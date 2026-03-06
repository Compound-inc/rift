-- Zero upstream schema (run against ZERO_UPSTREAM_DB).
-- Single source of truth for a fresh DB. zero-cache replicates via publication
-- zero_data (created by zero-dev-reset after applying this file).

-- threads
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_message_at BIGINT NOT NULL,
  generation_status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  user_set_title BOOLEAN,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  response_style TEXT,
  pinned BOOLEAN NOT NULL,
  active_child_by_parent JSONB NOT NULL DEFAULT '{}'::jsonb,
  branch_version BIGINT NOT NULL DEFAULT 1,
  share_id TEXT,
  share_status TEXT,
  shared_at BIGINT,
  allow_attachments BOOLEAN,
  org_only BOOLEAN,
  share_name BOOLEAN,
  owner_org_id TEXT,
  custom_instruction_id TEXT,
  reasoning_effort TEXT,
  mode_id TEXT
);
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS active_child_by_parent JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS branch_version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS mode_id TEXT;
CREATE INDEX IF NOT EXISTS threads_user_id ON threads (user_id);
CREATE INDEX IF NOT EXISTS threads_thread_id ON threads (thread_id);
CREATE INDEX IF NOT EXISTS threads_user_updated ON threads (user_id, updated_at);
CREATE INDEX IF NOT EXISTS threads_share_id ON threads (share_id);
CREATE INDEX IF NOT EXISTS threads_reasoning_effort ON threads (reasoning_effort);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reasoning TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at BIGINT,
  parent_message_id TEXT,
  branch_index INTEGER NOT NULL DEFAULT 1,
  branch_anchor_message_id TEXT,
  regen_source_message_id TEXT,
  role TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  server_error JSONB,
  model TEXT NOT NULL,
  attachments_ids JSONB NOT NULL,
  sources JSONB,
  model_params JSONB,
  provider_metadata JSONB
);
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS parent_message_id TEXT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS branch_index INTEGER NOT NULL DEFAULT 1;
DO $$
BEGIN
  ALTER TABLE messages
  ADD CONSTRAINT messages_branch_index_positive CHECK (branch_index >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS branch_anchor_message_id TEXT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS regen_source_message_id TEXT;
CREATE INDEX IF NOT EXISTS messages_thread_id ON messages (thread_id);
CREATE INDEX IF NOT EXISTS messages_thread_user ON messages (thread_id, user_id);
CREATE INDEX IF NOT EXISTS messages_user ON messages (user_id);
CREATE INDEX IF NOT EXISTS messages_thread_created ON messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS messages_thread_parent ON messages (thread_id, parent_message_id);

-- org_ai_policy
CREATE TABLE IF NOT EXISTS org_ai_policy (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  disabled_provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  disabled_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  compliance_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_key_status JSONB NOT NULL DEFAULT '{"syncedAt": 0, "hasAnyProviderKey": false, "providers": {"openai": false, "anthropic": false}}'::jsonb,
  enforced_mode_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL
);
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS provider_key_status JSONB NOT NULL DEFAULT '{"syncedAt": 0, "hasAnyProviderKey": false, "providers": {"openai": false, "anthropic": false}}'::jsonb;
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS enforced_mode_id TEXT;
CREATE INDEX IF NOT EXISTS org_ai_policy_organization_id ON org_ai_policy (organization_id);
CREATE INDEX IF NOT EXISTS org_ai_policy_updated_at ON org_ai_policy (updated_at);

-- attachments
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  thread_id TEXT,
  user_id TEXT NOT NULL,
  file_key TEXT NOT NULL,
  attachment_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_content TEXT NOT NULL,
  status TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  embedding_model TEXT,
  embedding_tokens BIGINT,
  embedding_dimensions BIGINT,
  embedding_chunks BIGINT,
  embedding_status TEXT,
  owner_org_id TEXT,
  workspace_id TEXT,
  access_scope TEXT DEFAULT 'user',
  access_group_ids JSONB,
  vector_indexed_at BIGINT,
  vector_error TEXT
);
CREATE INDEX IF NOT EXISTS attachments_thread_id ON attachments (thread_id);
CREATE INDEX IF NOT EXISTS attachments_message_id ON attachments (message_id);
CREATE INDEX IF NOT EXISTS attachments_user_id ON attachments (user_id);
