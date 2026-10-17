-- Documents are private to the owner of their originating thread. Timestamps are epoch ms.
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT,
  thread_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  kind TEXT NOT NULL CHECK (kind IN ('markdown', 'code')),
  language TEXT CHECK (char_length(language) <= 40),
  current_version INTEGER NOT NULL CHECK (current_version > 0),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT
);
CREATE INDEX IF NOT EXISTS documents_thread_owner ON documents (thread_id, user_id, organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_project ON documents (project_id) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS document_versions (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  content TEXT NOT NULL CHECK (octet_length(content) <= 204800),
  created_by TEXT NOT NULL CHECK (created_by IN ('assistant', 'user')),
  source_message_id TEXT,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (document_id, version)
);

-- Compact card references, independent of general AI SDK part persistence.
