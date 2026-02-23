-- Zero upstream tables (run against ZERO_UPSTREAM_DB).
-- Zero syncs these via logical replication; zero-cache uses ZERO_APP_PUBLICATIONS
-- (default: all tables in public schema) or create a publication, e.g.:
--   CREATE PUBLICATION zero_data FOR TABLE users, organizations, threads, messages, org_ai_policy;

-- users (mirrors Convex users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  workos_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  profile_picture_url TEXT
);
CREATE INDEX IF NOT EXISTS users_workos_id ON users (workos_id);

-- organizations (mirrors Convex organizations)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  workos_id TEXT NOT NULL,
  name TEXT NOT NULL,
  plan TEXT,
  product_status TEXT
);
CREATE INDEX IF NOT EXISTS organizations_workos_id ON organizations (workos_id);

-- threads (mirrors Convex threads)
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
  custom_instruction_id TEXT
);
CREATE INDEX IF NOT EXISTS threads_user_id ON threads (user_id);
CREATE INDEX IF NOT EXISTS threads_thread_id ON threads (thread_id);
CREATE INDEX IF NOT EXISTS threads_user_updated ON threads (user_id, updated_at);
CREATE INDEX IF NOT EXISTS threads_share_id ON threads (share_id);

-- messages (mirrors Convex messages)
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
