-- Zero upstream schema (run against ZERO_UPSTREAM_DB).
-- Single source of truth for a fresh DB. zero-cache replicates via publication
-- zero_data (created by zero-dev-reset after applying this file).

-- users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  workos_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  profile_picture_url TEXT
);
CREATE INDEX IF NOT EXISTS users_workos_id ON users (workos_id);

-- organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  workos_id TEXT NOT NULL,
  name TEXT NOT NULL,
  plan TEXT,
  product_status TEXT
);
CREATE INDEX IF NOT EXISTS organizations_workos_id ON organizations (workos_id);

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
  branch_parent_thread_id TEXT,
  branch_parent_public_message_id TEXT,
  share_id TEXT,
  share_status TEXT,
  shared_at BIGINT,
  allow_attachments BOOLEAN,
  org_only BOOLEAN,
  share_name BOOLEAN,
  owner_org_id TEXT,
  custom_instruction_id TEXT,
  reasoning_effort TEXT
);
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
  branches JSONB,
  role TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  server_error JSONB,
  model TEXT NOT NULL,
  attachments_ids JSONB NOT NULL,
  sources JSONB,
  model_params JSONB,
  provider_metadata JSONB
);
CREATE INDEX IF NOT EXISTS messages_thread_id ON messages (thread_id);
CREATE INDEX IF NOT EXISTS messages_thread_user ON messages (thread_id, user_id);
CREATE INDEX IF NOT EXISTS messages_user ON messages (user_id);
CREATE INDEX IF NOT EXISTS messages_thread_created ON messages (thread_id, created_at);

-- org_ai_policy
CREATE TABLE IF NOT EXISTS org_ai_policy (
  id TEXT PRIMARY KEY,
  org_workos_id TEXT NOT NULL UNIQUE,
  disabled_provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  disabled_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  compliance_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_ai_policy_org_workos_id ON org_ai_policy (org_workos_id);
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
