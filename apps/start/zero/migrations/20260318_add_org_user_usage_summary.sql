CREATE TABLE IF NOT EXISTS org_user_usage_summary (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('free', 'paid')),
  seat_index integer,
  monthly_used_percent bigint NOT NULL,
  monthly_remaining_percent bigint NOT NULL,
  monthly_reset_at bigint NOT NULL,
  window_used_percent bigint,
  window_remaining_percent bigint,
  window_reset_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS org_user_usage_summary_org_user
  ON org_user_usage_summary (organization_id, user_id);

CREATE INDEX IF NOT EXISTS org_user_usage_summary_org_updated_at
  ON org_user_usage_summary (organization_id, updated_at);
