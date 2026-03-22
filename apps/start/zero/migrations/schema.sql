CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Zero upstream schema (run against ZERO_UPSTREAM_DB).
-- Single source of truth for a fresh DB. zero-cache replicates via publication
-- zero_data (created by zero-dev-reset after applying this file).
--
-- Execution order: Run db:reset (Better Auth migrate first, then zero-dev-reset)
-- so user/organization/member/invitation exist before this schema runs.

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
  active_child_by_parent JSONB NOT NULL DEFAULT '{}'::jsonb,
  branch_version BIGINT NOT NULL DEFAULT 1,
  share_id TEXT,
  share_status TEXT,
  shared_at BIGINT,
  allow_attachments BOOLEAN,
  org_only BOOLEAN,
  share_name BOOLEAN,
  owner_org_id TEXT,
  custom_instruction_id TEXT,
  reasoning_effort TEXT,
  mode_id TEXT,
  disabled_tool_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_window_mode TEXT NOT NULL DEFAULT 'standard'
);
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS active_child_by_parent JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS branch_version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS mode_id TEXT;
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS disabled_tool_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS context_window_mode TEXT NOT NULL DEFAULT 'standard';
CREATE INDEX IF NOT EXISTS threads_user_id ON threads (user_id);
CREATE INDEX IF NOT EXISTS threads_thread_id ON threads (thread_id);
CREATE INDEX IF NOT EXISTS threads_user_updated ON threads (user_id, updated_at);
CREATE INDEX IF NOT EXISTS threads_user_org_visibility_updated
  ON threads (user_id, owner_org_id, visibility, updated_at DESC);
CREATE INDEX IF NOT EXISTS threads_share_id ON threads (share_id);
CREATE INDEX IF NOT EXISTS threads_reasoning_effort ON threads (reasoning_effort);
CREATE INDEX IF NOT EXISTS threads_context_window_mode ON threads (context_window_mode);
CREATE INDEX IF NOT EXISTS threads_title_search_fts
  ON threads
  USING GIN (to_tsvector('simple', COALESCE(title, '')));
CREATE INDEX IF NOT EXISTS threads_title_search_trgm
  ON threads
  USING GIN (LOWER(title) gin_trgm_ops);

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
  parent_message_id TEXT,
  branch_index INTEGER NOT NULL DEFAULT 1,
  branch_anchor_message_id TEXT,
  regen_source_message_id TEXT,
  role TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  server_error JSONB,
  model TEXT NOT NULL,
  attachments_ids JSONB NOT NULL,
  sources JSONB,
  model_params JSONB,
  provider_metadata JSONB,
  generation_metadata JSONB,
  ai_cost DOUBLE PRECISION,
  public_cost DOUBLE PRECISION,
  used_byok BOOLEAN,
  input_tokens BIGINT,
  output_tokens BIGINT,
  total_tokens BIGINT,
  reasoning_tokens BIGINT,
  text_tokens BIGINT,
  cache_read_tokens BIGINT,
  cache_write_tokens BIGINT,
  no_cache_tokens BIGINT,
  billable_web_search_calls BIGINT
);
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS parent_message_id TEXT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS branch_index INTEGER NOT NULL DEFAULT 1;
DO $$
BEGIN
  ALTER TABLE messages
  ADD CONSTRAINT messages_branch_index_positive CHECK (branch_index >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS branch_anchor_message_id TEXT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS regen_source_message_id TEXT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS generation_metadata JSONB;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS ai_cost DOUBLE PRECISION;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS public_cost DOUBLE PRECISION;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS used_byok BOOLEAN;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS input_tokens BIGINT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS output_tokens BIGINT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS total_tokens BIGINT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS reasoning_tokens BIGINT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS text_tokens BIGINT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS cache_read_tokens BIGINT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS cache_write_tokens BIGINT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS no_cache_tokens BIGINT;
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS billable_web_search_calls BIGINT;
CREATE INDEX IF NOT EXISTS messages_thread_id ON messages (thread_id);
CREATE INDEX IF NOT EXISTS messages_thread_user ON messages (thread_id, user_id);
CREATE INDEX IF NOT EXISTS messages_user ON messages (user_id);
CREATE INDEX IF NOT EXISTS messages_thread_created ON messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS messages_thread_parent ON messages (thread_id, parent_message_id);
CREATE INDEX IF NOT EXISTS messages_user_ai_cost ON messages (user_id, ai_cost);
CREATE INDEX IF NOT EXISTS messages_user_public_cost ON messages (user_id, public_cost);
CREATE INDEX IF NOT EXISTS messages_user_total_tokens ON messages (user_id, total_tokens);
CREATE INDEX IF NOT EXISTS messages_content_search_fts
  ON messages
  USING GIN (to_tsvector('simple', COALESCE(content, '')));
CREATE INDEX IF NOT EXISTS messages_content_search_trgm
  ON messages
  USING GIN (LOWER(content) gin_trgm_ops)
  WHERE status = 'done' AND role IN ('user', 'assistant');
CREATE INDEX IF NOT EXISTS messages_user_created_desc
  ON messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_user_thread_search_scope
  ON messages (user_id, thread_id, created_at DESC)
  WHERE status = 'done' AND role IN ('user', 'assistant');

-- org_ai_policy
CREATE TABLE IF NOT EXISTS org_ai_policy (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  disabled_provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  disabled_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  compliance_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_native_tools_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  external_tools_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  disabled_tool_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  org_knowledge_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  active_org_knowledge_count BIGINT NOT NULL DEFAULT 0,
  provider_key_status JSONB NOT NULL DEFAULT '{"syncedAt": 0, "hasAnyProviderKey": false, "providers": {"openai": false, "anthropic": false}}'::jsonb,
  enforced_mode_id TEXT,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL
);
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS provider_key_status JSONB NOT NULL DEFAULT '{"syncedAt": 0, "hasAnyProviderKey": false, "providers": {"openai": false, "anthropic": false}}'::jsonb;
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS enforced_mode_id TEXT;
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS provider_native_tools_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS external_tools_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS disabled_tool_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS org_knowledge_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE org_ai_policy
ADD COLUMN IF NOT EXISTS active_org_knowledge_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS org_ai_policy_organization_id ON org_ai_policy (organization_id);
CREATE INDEX IF NOT EXISTS org_ai_policy_updated_at ON org_ai_policy (updated_at);

-- org_provider_api_key
CREATE TABLE IF NOT EXISTS org_provider_api_key (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS org_provider_api_key_org_provider_unique
  ON org_provider_api_key (organization_id, provider_id);
CREATE INDEX IF NOT EXISTS org_provider_api_key_org_idx
  ON org_provider_api_key (organization_id);

-- org_billing_account
CREATE TABLE IF NOT EXISTS org_billing_account (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_billing_account_organization_id ON org_billing_account (organization_id);

-- org_subscription
CREATE TABLE IF NOT EXISTS org_subscription (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  billing_account_id TEXT NOT NULL,
  provider_subscription_id TEXT,
  plan_id TEXT NOT NULL,
  billing_interval TEXT,
  seat_count INTEGER,
  status TEXT NOT NULL,
  current_period_start BIGINT,
  current_period_end BIGINT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_plan_id TEXT,
  scheduled_seat_count INTEGER,
  scheduled_change_effective_at BIGINT,
  pending_change_reason TEXT,
  usage_policy_template_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_subscription_organization_id ON org_subscription (organization_id);
CREATE INDEX IF NOT EXISTS org_subscription_billing_account_id ON org_subscription (billing_account_id);
CREATE INDEX IF NOT EXISTS org_subscription_status ON org_subscription (status);

-- org_entitlement_snapshot
CREATE TABLE IF NOT EXISTS org_entitlement_snapshot (
  organization_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  billing_provider TEXT NOT NULL,
  subscription_status TEXT NOT NULL,
  seat_count INTEGER,
  active_member_count INTEGER NOT NULL DEFAULT 0,
  pending_invitation_count INTEGER NOT NULL DEFAULT 0,
  is_over_seat_limit BOOLEAN NOT NULL DEFAULT FALSE,
  effective_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_sync_status TEXT NOT NULL DEFAULT 'ok',
  usage_sync_error TEXT,
  computed_at BIGINT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);

-- org_member_access
CREATE TABLE IF NOT EXISTS org_member_access (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  reason_code TEXT,
  suspended_at BIGINT,
  reactivated_at BIGINT,
  source_subscription_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS org_member_access_org_user ON org_member_access (organization_id, user_id);
CREATE INDEX IF NOT EXISTS org_member_access_status ON org_member_access (status);

-- Better Auth owns user/organization; we add app-specific columns. Run db:reset so
-- auth migrations run first and these tables exist.
ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

ALTER TABLE organization
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

CREATE TABLE IF NOT EXISTS subscription (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete',
  "periodStart" TIMESTAMPTZ,
  "periodEnd" TIMESTAMPTZ,
  "trialStart" TIMESTAMPTZ,
  "trialEnd" TIMESTAMPTZ,
  "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
  "cancelAt" TIMESTAMPTZ,
  "canceledAt" TIMESTAMPTZ,
  "endedAt" TIMESTAMPTZ,
  seats INTEGER,
  "billingInterval" TEXT,
  "stripeScheduleId" TEXT
);
CREATE INDEX IF NOT EXISTS subscription_reference_id ON subscription ("referenceId");
CREATE INDEX IF NOT EXISTS subscription_stripe_subscription_id ON subscription ("stripeSubscriptionId");

CREATE OR REPLACE FUNCTION org_current_seat_limit(target_organization_id TEXT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT coalesce(
    (
      SELECT GREATEST(coalesce(seat_count, 1), 1)
      FROM org_subscription
      WHERE organization_id = target_organization_id
        AND status IN ('active', 'trialing', 'past_due')
      ORDER BY updated_at DESC
      LIMIT 1
    ),
    1
  );
$$;

CREATE OR REPLACE FUNCTION enforce_pending_invitation_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  seat_limit INTEGER;
  active_member_count INTEGER;
  pending_invitation_count INTEGER;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'pending'
     AND OLD."organizationId" = NEW."organizationId" THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM organization
  WHERE id = NEW."organizationId"
  FOR UPDATE;

  seat_limit := org_current_seat_limit(NEW."organizationId");

  SELECT count(*)::int
  INTO active_member_count
  FROM member
  WHERE "organizationId" = NEW."organizationId";

  SELECT count(*)::int
  INTO pending_invitation_count
  FROM invitation
  WHERE "organizationId" = NEW."organizationId"
    AND status = 'pending'
    AND id <> coalesce(NEW.id, '');

  IF active_member_count + pending_invitation_count + 1 > seat_limit THEN
    RAISE EXCEPTION 'Organization seat limit reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invitation_seat_limit_guard ON invitation;
CREATE TRIGGER invitation_seat_limit_guard
BEFORE INSERT OR UPDATE OF status, "organizationId"
ON invitation
FOR EACH ROW
EXECUTE FUNCTION enforce_pending_invitation_seat_limit();

CREATE OR REPLACE FUNCTION enforce_active_member_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  seat_limit INTEGER;
  active_member_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."organizationId" = NEW."organizationId" THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM organization
  WHERE id = NEW."organizationId"
  FOR UPDATE;

  seat_limit := org_current_seat_limit(NEW."organizationId");

  SELECT count(*)::int
  INTO active_member_count
  FROM member
  WHERE "organizationId" = NEW."organizationId"
    AND id <> coalesce(NEW.id, '');

  IF active_member_count + 1 > seat_limit THEN
    RAISE EXCEPTION 'Organization seat limit reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_seat_limit_guard ON member;
CREATE TRIGGER member_seat_limit_guard
BEFORE INSERT OR UPDATE OF "organizationId"
ON member
FOR EACH ROW
EXECUTE FUNCTION enforce_active_member_seat_limit();

-- usage_policy_template
CREATE TABLE IF NOT EXISTS usage_policy_template (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  seat_window_duration_ms BIGINT NOT NULL,
  target_margin_ratio_bps INTEGER NOT NULL,
  monthly_overage_ratio_bps INTEGER NOT NULL,
  average_sessions_per_seat_per_month INTEGER NOT NULL,
  reserve_headroom_ratio_bps INTEGER NOT NULL,
  min_reserve_nano_usd BIGINT NOT NULL,
  max_reserve_nano_usd BIGINT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS usage_policy_template_plan_feature ON usage_policy_template (plan_id, feature_key);

-- org_usage_policy_override
CREATE TABLE IF NOT EXISTS org_usage_policy_override (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  seat_window_duration_ms BIGINT,
  target_margin_ratio_bps INTEGER,
  monthly_overage_ratio_bps INTEGER,
  average_sessions_per_seat_per_month INTEGER,
  reserve_headroom_ratio_bps INTEGER,
  min_reserve_nano_usd BIGINT,
  organization_monthly_budget_nano_usd BIGINT,
  max_reserve_nano_usd BIGINT,
  enabled BOOLEAN,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS org_usage_policy_override_org_feature ON org_usage_policy_override (organization_id, feature_key);

-- org_seat_slot
CREATE TABLE IF NOT EXISTS org_seat_slot (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  org_subscription_id TEXT,
  plan_id TEXT NOT NULL,
  cycle_start_at BIGINT NOT NULL,
  cycle_end_at BIGINT NOT NULL,
  seat_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  current_assignee_user_id TEXT,
  first_assigned_at BIGINT,
  last_assigned_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS org_seat_slot_unique_cycle_index ON org_seat_slot (organization_id, cycle_start_at, cycle_end_at, seat_index);
CREATE INDEX IF NOT EXISTS org_seat_slot_org_assignee ON org_seat_slot (organization_id, current_assignee_user_id);

-- org_seat_slot_assignment
CREATE TABLE IF NOT EXISTS org_seat_slot_assignment (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  seat_slot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  cycle_start_at BIGINT NOT NULL,
  cycle_end_at BIGINT NOT NULL,
  assignment_status TEXT NOT NULL,
  assigned_at BIGINT NOT NULL,
  released_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_seat_slot_assignment_org_user ON org_seat_slot_assignment (organization_id, user_id, cycle_start_at);
CREATE UNIQUE INDEX IF NOT EXISTS org_seat_slot_assignment_active_slot ON org_seat_slot_assignment (seat_slot_id) WHERE assignment_status = 'active';

-- org_seat_bucket_balance
CREATE TABLE IF NOT EXISTS org_seat_bucket_balance (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  seat_slot_id TEXT NOT NULL,
  bucket_type TEXT NOT NULL,
  total_nano_usd BIGINT NOT NULL,
  remaining_nano_usd BIGINT NOT NULL,
  current_window_started_at BIGINT,
  current_window_ends_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS org_seat_bucket_balance_slot_bucket ON org_seat_bucket_balance (seat_slot_id, bucket_type);

-- org_seat_bucket_ledger
CREATE TABLE IF NOT EXISTS org_seat_bucket_ledger (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  seat_slot_id TEXT NOT NULL,
  bucket_balance_id TEXT NOT NULL,
  reservation_id TEXT,
  monetization_event_id TEXT,
  entry_type TEXT NOT NULL,
  amount_nano_usd BIGINT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_seat_bucket_ledger_bucket_balance ON org_seat_bucket_ledger (bucket_balance_id, created_at);

-- org_usage_reservation
CREATE TABLE IF NOT EXISTS org_usage_reservation (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  seat_slot_id TEXT NOT NULL,
  status TEXT NOT NULL,
  estimated_nano_usd BIGINT NOT NULL,
  reserved_nano_usd BIGINT NOT NULL,
  released_nano_usd BIGINT NOT NULL DEFAULT 0,
  allocation JSONB NOT NULL DEFAULT '[]'::jsonb,
  failure_code TEXT,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_usage_reservation_org_status ON org_usage_reservation (organization_id, status, expires_at);

-- org_usage_event
CREATE TABLE IF NOT EXISTS org_usage_event (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  seat_slot_id TEXT,
  assistant_message_id TEXT,
  model_id TEXT NOT NULL,
  used_byok BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_nano_usd BIGINT,
  actual_nano_usd BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_usage_event_org_created_at ON org_usage_event (organization_id, created_at);

-- org_monetization_event
CREATE TABLE IF NOT EXISTS org_monetization_event (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  seat_slot_id TEXT,
  usage_event_id TEXT,
  reservation_id TEXT,
  estimated_nano_usd BIGINT NOT NULL,
  actual_nano_usd BIGINT NOT NULL,
  captured_nano_usd BIGINT NOT NULL DEFAULT 0,
  refunded_nano_usd BIGINT NOT NULL DEFAULT 0,
  forgiven_nano_usd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_monetization_event_org_status ON org_monetization_event (organization_id, status, updated_at);

-- org_user_usage_summary
CREATE TABLE IF NOT EXISTS org_user_usage_summary (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('free', 'paid')),
  seat_index INTEGER,
  monthly_used_percent BIGINT NOT NULL,
  monthly_remaining_percent BIGINT NOT NULL,
  monthly_reset_at BIGINT NOT NULL,
  window_used_percent BIGINT,
  window_remaining_percent BIGINT,
  window_reset_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS org_user_usage_summary_org_user ON org_user_usage_summary (organization_id, user_id);
CREATE INDEX IF NOT EXISTS org_user_usage_summary_org_updated_at ON org_user_usage_summary (organization_id, updated_at);

-- chat_request_rate_limit_window
CREATE TABLE IF NOT EXISTS chat_request_rate_limit_window (
  user_id TEXT NOT NULL,
  window_started_at BIGINT NOT NULL,
  hits INTEGER NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, window_started_at)
);

-- chat_free_allowance_window
CREATE TABLE IF NOT EXISTS chat_free_allowance_window (
  user_id TEXT NOT NULL,
  policy_key TEXT NOT NULL,
  window_started_at BIGINT NOT NULL,
  hits INTEGER NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, policy_key, window_started_at)
);

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
  org_knowledge_kind TEXT,
  org_knowledge_active BOOLEAN NOT NULL DEFAULT FALSE,
  access_group_ids JSONB,
  vector_indexed_at BIGINT,
  vector_error TEXT
);
ALTER TABLE attachments
ADD COLUMN IF NOT EXISTS org_knowledge_kind TEXT;
ALTER TABLE attachments
ADD COLUMN IF NOT EXISTS org_knowledge_active BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS attachments_thread_id ON attachments (thread_id);
CREATE INDEX IF NOT EXISTS attachments_message_id ON attachments (message_id);
CREATE INDEX IF NOT EXISTS attachments_user_id ON attachments (user_id);
CREATE INDEX IF NOT EXISTS attachments_org_knowledge_lookup
  ON attachments (owner_org_id, org_knowledge_kind, org_knowledge_active, status, updated_at DESC);
