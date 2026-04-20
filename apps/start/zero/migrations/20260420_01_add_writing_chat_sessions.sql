CREATE TABLE IF NOT EXISTS writing_chat_sessions (
  chat_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_jsonl TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
