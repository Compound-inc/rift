-- Let project rows participate in the same pinned-first sidebar ordering as chats.
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

DROP INDEX IF EXISTS projects_user_visible;
CREATE INDEX IF NOT EXISTS projects_user_visible
  ON projects (user_id, pinned DESC, updated_at DESC)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS projects_org_visible;
CREATE INDEX IF NOT EXISTS projects_org_visible
  ON projects (organization_id, pinned DESC, updated_at DESC)
  WHERE deleted_at IS NULL AND visibility = 'org';
