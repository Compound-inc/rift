-- Projects feature foundation.
-- See ADR-0001 (soft-delete), ADR-0002 (RAG union), ADR-0003 (unconditional context).
-- See CONTEXT.md for the canonical definition of Project.

-- Core projects table.
CREATE TABLE IF NOT EXISTS projects (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  organization_id     TEXT,
  name                TEXT NOT NULL,
  description         TEXT,
  custom_instruction  TEXT,
  visibility          TEXT NOT NULL DEFAULT 'private',
  icon                TEXT,
  color               TEXT,
  deleted_at          BIGINT,
  created_at          BIGINT NOT NULL,
  updated_at          BIGINT NOT NULL
);

-- Sidebar list "projects visible to me" — partial indexes skip soft-deleted rows.
CREATE INDEX IF NOT EXISTS projects_user_visible
  ON projects (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_org_visible
  ON projects (organization_id, updated_at DESC)
  WHERE deleted_at IS NULL AND visibility = 'org';

-- A Thread belongs to at most one Project. FK is preserved across soft-delete
-- of the parent Project (ADR-0001); read paths must filter via
-- projects.deleted_at IS NULL when joining.
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS project_id TEXT;

CREATE INDEX IF NOT EXISTS threads_project_id ON threads (project_id);

-- Project-level attachments (RAG corpus). The dangling `workspace_id` column
-- is intentionally left in place for now; new code uses `project_id`. The
-- access_scope value 'project' is added to the conceptual TypeScript enum
-- (no DB constraint exists on access_scope) — see schema.ts.
ALTER TABLE attachments
ADD COLUMN IF NOT EXISTS project_id TEXT;

CREATE INDEX IF NOT EXISTS attachments_project_id ON attachments (project_id);
