-- Personal instructions follow the user; memory consent is isolated per workspace.
CREATE TABLE IF NOT EXISTS user_personalization (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  instructions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  memory_default_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  about_you TEXT NOT NULL DEFAULT '' CHECK (char_length(about_you) <= 1500),
  response_preferences TEXT NOT NULL DEFAULT '' CHECK (char_length(response_preferences) <= 1500),
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_memory_preference (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  generation TEXT NOT NULL DEFAULT 'initial',
  retired_generations JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, organization_id)
);

ALTER TABLE org_ai_policy ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Existing accounts remain opt-in even when they later join a new workspace.
INSERT INTO user_personalization (user_id, memory_default_enabled, updated_at)
SELECT id, FALSE, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT FROM "user"
ON CONFLICT (user_id) DO NOTHING;
