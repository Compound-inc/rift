-- Skills feature foundation.
-- See ADR-0005 (skills) and CONTEXT.md for the canonical definition.
-- See ADR-0001 (soft-delete) for the Windows-folder cascade pattern.

-- Core skills table. A Skill has one of three scopes encoded by the nullable
-- pair (project_id, organization_id):
--   project_id set                     -> Project Skill
--   project_id null, org null          -> Personal Skill
--   project_id null, org set           -> Org-Shared Skill
-- user_id is always set to the original creator (used for permission checks
-- on Personal and Org-Shared scopes; carried for attribution on Project
-- Skills, where the project's owner is the actual editor per ADR-0005).
CREATE TABLE IF NOT EXISTS skills (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  organization_id     TEXT,
  project_id          TEXT,
  name                TEXT NOT NULL,
  body                TEXT NOT NULL,
  description         TEXT,
  -- Org-Shared only: when true, org admins may co-edit this skill alongside
  -- the creator. Meaningless when organization_id IS NULL.
  allow_admin_edit    BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at          BIGINT,
  created_at          BIGINT NOT NULL,
  updated_at          BIGINT NOT NULL
);

-- Per-scope name uniqueness. Partial on deleted_at IS NULL so soft-deletes
-- free their name slot (ADR-0005).

-- Personal scope: one user cannot have two active personal skills with the
-- same name.
CREATE UNIQUE INDEX IF NOT EXISTS skills_personal_unique
  ON skills (user_id, name)
  WHERE project_id IS NULL
    AND organization_id IS NULL
    AND deleted_at IS NULL;

-- Project scope: one project cannot have two active skills with the same
-- name.
CREATE UNIQUE INDEX IF NOT EXISTS skills_project_unique
  ON skills (project_id, name)
  WHERE project_id IS NOT NULL
    AND deleted_at IS NULL;

-- Org-Shared scope: first-share wins. Two different users cannot both share
-- a personal skill named the same with the same org.
CREATE UNIQUE INDEX IF NOT EXISTS skills_org_shared_unique
  ON skills (organization_id, name)
  WHERE organization_id IS NOT NULL
    AND project_id IS NULL
    AND deleted_at IS NULL;

-- Read-path helpers. Each scope's "list visible skills" query filters on
-- the columns named in the corresponding partial index.
CREATE INDEX IF NOT EXISTS skills_personal_list
  ON skills (user_id, updated_at DESC)
  WHERE project_id IS NULL
    AND organization_id IS NULL
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS skills_project_list
  ON skills (project_id, updated_at DESC)
  WHERE project_id IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS skills_org_shared_list
  ON skills (organization_id, updated_at DESC)
  WHERE organization_id IS NOT NULL
    AND project_id IS NULL
    AND deleted_at IS NULL;

-- Per-project override list (ADR-0005). A row means "this global skill is
-- hidden in this project's slash menu". Owned/edited by the project owner;
-- empty by default (allow-by-default).
CREATE TABLE IF NOT EXISTS skill_project_overrides (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  skill_id            TEXT NOT NULL,
  created_at          BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS skill_project_overrides_unique
  ON skill_project_overrides (project_id, skill_id);

CREATE INDEX IF NOT EXISTS skill_project_overrides_by_project
  ON skill_project_overrides (project_id);
