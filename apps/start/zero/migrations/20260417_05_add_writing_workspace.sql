CREATE TABLE IF NOT EXISTS writing_projects (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  owner_org_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  head_snapshot_id TEXT,
  default_conversation_id TEXT,
  auto_accept_mode BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS writing_projects_owner_updated_idx
  ON writing_projects (owner_user_id, owner_org_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS writing_projects_owner_slug_idx
  ON writing_projects (owner_user_id, owner_org_id, slug);

CREATE TABLE IF NOT EXISTS writing_blobs (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS writing_blobs_sha256_idx
  ON writing_blobs (sha256);

CREATE TABLE IF NOT EXISTS writing_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  path TEXT NOT NULL,
  parent_path TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  blob_id TEXT,
  sha256 TEXT,
  line_count INTEGER,
  size_bytes BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS writing_entries_project_path_idx
  ON writing_entries (project_id, path);
CREATE INDEX IF NOT EXISTS writing_entries_project_parent_idx
  ON writing_entries (project_id, parent_path, name);

CREATE TABLE IF NOT EXISTS writing_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_snapshot_id TEXT,
  source TEXT NOT NULL,
  summary TEXT NOT NULL,
  conversation_id TEXT,
  message_id TEXT,
  created_by_user_id TEXT NOT NULL,
  restored_from_snapshot_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS writing_snapshots_project_created_idx
  ON writing_snapshots (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS writing_snapshot_entries (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  blob_id TEXT,
  sha256 TEXT,
  line_count INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS writing_snapshot_entries_snapshot_path_idx
  ON writing_snapshot_entries (snapshot_id, path);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  owner_org_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  default_model_id TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_message_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_conversations_scope_updated_idx
  ON agent_conversations (product, scope_type, scope_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_turns (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  product TEXT NOT NULL,
  runtime TEXT NOT NULL,
  status TEXT NOT NULL,
  request_id TEXT NOT NULL,
  model_id TEXT,
  provider_id TEXT,
  turn_index INTEGER NOT NULL,
  user_message_id TEXT,
  assistant_message_id TEXT,
  change_set_id TEXT,
  turn_json JSONB NOT NULL,
  error_json JSONB,
  started_at BIGINT NOT NULL,
  completed_at BIGINT,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_turns_conversation_turn_idx
  ON agent_turns (conversation_id, turn_index ASC);
CREATE INDEX IF NOT EXISTS agent_turns_conversation_started_idx
  ON agent_turns (conversation_id, started_at ASC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  product TEXT NOT NULL,
  role TEXT NOT NULL,
  message_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  parts_json JSONB NOT NULL,
  tool_call_id TEXT,
  tool_name TEXT,
  is_error BOOLEAN,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_messages_conversation_message_idx
  ON agent_messages (conversation_id, message_index ASC);
CREATE INDEX IF NOT EXISTS agent_messages_turn_message_idx
  ON agent_messages (turn_id, message_index ASC);
CREATE INDEX IF NOT EXISTS agent_messages_tool_call_idx
  ON agent_messages (tool_call_id)
  WHERE tool_call_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_sessions (
  conversation_id TEXT PRIMARY KEY,
  runtime TEXT NOT NULL,
  session_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS writing_change_sets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  assistant_message_id TEXT,
  base_snapshot_id TEXT NOT NULL,
  status TEXT NOT NULL,
  auto_accept BOOLEAN NOT NULL DEFAULT FALSE,
  summary TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  resolved_at BIGINT
);
CREATE INDEX IF NOT EXISTS writing_change_sets_project_created_idx
  ON writing_change_sets (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS writing_changes (
  id TEXT PRIMARY KEY,
  change_set_id TEXT NOT NULL,
  path TEXT NOT NULL,
  from_path TEXT,
  operation TEXT NOT NULL,
  base_blob_id TEXT,
  proposed_blob_id TEXT,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS writing_changes_change_set_idx
  ON writing_changes (change_set_id, path);

CREATE TABLE IF NOT EXISTS writing_change_hunks (
  id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL,
  hunk_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  old_start INTEGER NOT NULL,
  old_lines INTEGER NOT NULL,
  new_start INTEGER NOT NULL,
  new_lines INTEGER NOT NULL,
  patch_text TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS writing_change_hunks_change_idx
  ON writing_change_hunks (change_id, hunk_index);

CREATE TABLE IF NOT EXISTS user_skills (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  archived_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS user_skills_owner_slug_idx
  ON user_skills (owner_user_id, slug);

CREATE TABLE IF NOT EXISTS writing_project_skill_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_skill_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS writing_project_skill_links_unique_idx
  ON writing_project_skill_links (project_id, user_skill_id);
