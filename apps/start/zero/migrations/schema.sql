CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Zero upstream schema (run against ZERO_UPSTREAM_DB).
-- Single source of truth for a fresh DB. zero-cache replicates via publication
-- zero_data (created by zero-dev-reset after applying this file).
--
-- Execution order: Run db:reset (Better Auth migrate first, then zero-dev-reset)
-- so user/organization/member/invitation exist before this schema runs.

-- instance_settings
CREATE TABLE IF NOT EXISTS instance_settings (
  id TEXT PRIMARY KEY,
  setup_completed_at TIMESTAMPTZ,
  first_admin_user_id TEXT,
  signup_policy TEXT NOT NULL DEFAULT 'invite_only',
  signup_secret_hash TEXT,
  public_app_locked BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE instance_settings
ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;
ALTER TABLE instance_settings
ADD COLUMN IF NOT EXISTS first_admin_user_id TEXT;
ALTER TABLE instance_settings
ADD COLUMN IF NOT EXISTS signup_policy TEXT NOT NULL DEFAULT 'invite_only';
ALTER TABLE instance_settings
ADD COLUMN IF NOT EXISTS signup_secret_hash TEXT;
ALTER TABLE instance_settings
ADD COLUMN IF NOT EXISTS public_app_locked BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE instance_settings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE instance_settings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DO $$
BEGIN
  ALTER TABLE instance_settings
  ADD CONSTRAINT instance_settings_signup_policy_check
  CHECK (signup_policy IN ('invite_only', 'shared_secret', 'open'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
INSERT INTO instance_settings (
  id,
  signup_policy,
  public_app_locked
)
VALUES (
  'default',
  'invite_only',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

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

-- org_policy
CREATE TABLE IF NOT EXISTS org_policy (
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
ALTER TABLE org_policy
ADD COLUMN IF NOT EXISTS provider_key_status JSONB NOT NULL DEFAULT '{"syncedAt": 0, "hasAnyProviderKey": false, "providers": {"openai": false, "anthropic": false}}'::jsonb;
ALTER TABLE org_policy
ADD COLUMN IF NOT EXISTS enforced_mode_id TEXT;
ALTER TABLE org_policy
ADD COLUMN IF NOT EXISTS provider_native_tools_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE org_policy
ADD COLUMN IF NOT EXISTS external_tools_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE org_policy
ADD COLUMN IF NOT EXISTS disabled_tool_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE org_policy
ADD COLUMN IF NOT EXISTS org_knowledge_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE org_policy
ADD COLUMN IF NOT EXISTS active_org_knowledge_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS org_policy_organization_id ON org_policy (organization_id);
CREATE INDEX IF NOT EXISTS org_policy_updated_at ON org_policy (updated_at);

-- org_product_config was dropped in 20260514_drop_org_product_config.sql.
-- Writing (its only feature) moved to the product-addon entitlement model.
-- See apps/start/PRODUCTS_AND_ADDONS.md.

-- org_product_policy
CREATE TABLE IF NOT EXISTS org_product_policy (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  disabled_provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  disabled_model_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  disabled_tool_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  compliance_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS org_product_policy_org_product_key
  ON org_product_policy (organization_id, product_key);
CREATE INDEX IF NOT EXISTS org_product_policy_updated_at ON org_product_policy (updated_at);

INSERT INTO org_product_policy (
  id,
  organization_id,
  product_key,
  capabilities,
  settings,
  disabled_provider_ids,
  disabled_model_ids,
  disabled_tool_keys,
  compliance_flags,
  version,
  updated_at
)
SELECT
  'chat-policy:' || organization_id AS id,
  organization_id,
  'chat' AS product_key,
  '{}'::jsonb AS capabilities,
  jsonb_strip_nulls(
    jsonb_build_object(
      'providerNativeToolsEnabled',
      CASE
        WHEN COALESCE(provider_native_tools_enabled, true) IS DISTINCT FROM true
          THEN COALESCE(provider_native_tools_enabled, true)
        ELSE NULL
      END,
      'externalToolsEnabled',
      CASE
        WHEN COALESCE(external_tools_enabled, true) IS DISTINCT FROM true
          THEN COALESCE(external_tools_enabled, true)
        ELSE NULL
      END
    )
  ) AS settings,
  COALESCE(disabled_provider_ids, '[]'::jsonb) AS disabled_provider_ids,
  COALESCE(disabled_model_ids, '[]'::jsonb) AS disabled_model_ids,
  COALESCE(disabled_tool_keys, '[]'::jsonb) AS disabled_tool_keys,
  '{}'::jsonb AS compliance_flags,
  1 AS version,
  COALESCE(
    updated_at,
    FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
  ) AS updated_at
FROM org_policy
WHERE
  COALESCE(provider_native_tools_enabled, true) IS DISTINCT FROM true
  OR COALESCE(external_tools_enabled, true) IS DISTINCT FROM true
  OR jsonb_array_length(COALESCE(disabled_provider_ids, '[]'::jsonb)) > 0
  OR jsonb_array_length(COALESCE(disabled_model_ids, '[]'::jsonb)) > 0
  OR jsonb_array_length(COALESCE(disabled_tool_keys, '[]'::jsonb)) > 0
ON CONFLICT (organization_id, product_key) DO NOTHING;

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
  product_addon_entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_sync_status TEXT NOT NULL DEFAULT 'ok',
  usage_sync_error TEXT,
  computed_at BIGINT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);
ALTER TABLE org_entitlement_snapshot
ADD COLUMN IF NOT EXISTS product_addon_entitlements JSONB NOT NULL DEFAULT '{}'::jsonb;

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
  target_margin_ratio_bps INTEGER NOT NULL,
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
  target_margin_ratio_bps INTEGER,
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
-- HR Recruitment module schema.
--
-- Every table is org-scoped (`organization_id NOT NULL` + composite indexes
-- on `(organization_id, …)`) so cross-org reads are physically impossible
-- via Zero queries that always filter by org first. Archive/trash flows are
-- expressed via `archived_at` columns rather than hard deletes so the
-- platform can always rematch old CVs against new positions.
--
-- See `apps/start/PERMISSIONS.md` and `apps/start/PRODUCTS_AND_ADDONS.md`
-- for how the recruitment + background-check addons sit on top of these
-- tables.

-- ---------------------------------------------------------------------------
-- Positions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_position (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  arrangement TEXT NOT NULL DEFAULT 'hybrid',
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT NOT NULL DEFAULT '',
  hiring_manager TEXT NOT NULL DEFAULT '',
  compensation TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Catalog ids (e.g. `screening-technical-v1`) the workflow will dispatch.
  -- Stored as JSON to allow per-position ordering and easy expansion.
  recommended_evaluation_kinds JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Cached embedding of the position description. The pipeline keeps it
  -- around so future stage-1 cosine-similarity prefilters do not have
  -- to re-embed the JD for every CV upload. Refreshed when the
  -- description / requirements change. AI scoring is the source of
  -- truth today; this is reserved for the upcoming hybrid path.
  description_embedding JSONB,
  description_embedding_model TEXT,
  description_embedding_dimensions INTEGER,
  description_embedding_updated_at BIGINT,
  archived_at BIGINT,
  archived_by TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_by TEXT NOT NULL,
  CONSTRAINT hr_position_status_check CHECK (
    status IN ('draft', 'open', 'paused', 'filled', 'archived')
  ),
  CONSTRAINT hr_position_arrangement_check CHECK (
    arrangement IN ('remote', 'hybrid', 'onsite')
  ),
  CONSTRAINT hr_position_employment_type_check CHECK (
    employment_type IN ('full_time', 'part_time', 'contract', 'internship')
  )
);

CREATE INDEX IF NOT EXISTS hr_position_org
  ON hr_position (organization_id);
CREATE INDEX IF NOT EXISTS hr_position_org_status_updated
  ON hr_position (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS hr_position_org_archived_at
  ON hr_position (organization_id, archived_at);

-- ---------------------------------------------------------------------------
-- Candidates (org-isolated profiles deduped by normalized email)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_candidate (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  -- normalized_email is the authoritative dedup key inside an org. Stored
  -- separately from the original-cased email so display can preserve case
  -- while lookups remain case-insensitive.
  normalized_email TEXT,
  email TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  -- The most recent CV attached to this candidate. Each application also
  -- records the CV used at upload time, so swapping the active CV later
  -- never rewrites historical applications.
  latest_cv_attachment_id TEXT,
  latest_cv_text TEXT,
  -- Cached embedding of the latest CV. Like the position embedding,
  -- this is reserved for the upcoming hybrid affinity path; the AI
  -- extractor remains the source of truth for ranking today.
  latest_cv_embedding JSONB,
  latest_cv_embedding_model TEXT,
  latest_cv_embedding_dimensions INTEGER,
  latest_cv_indexed_at BIGINT,
  -- Free-form aliases collected as we see the candidate (different name
  -- spellings, alternate emails, etc). Used for future fuzzy matching.
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- merged_into_candidate_id lets admins consolidate two profiles when
  -- they're confirmed to be the same person. Soft pointer; the original
  -- row stays for audit. Look-ups follow the chain to the surviving id.
  merged_into_candidate_id TEXT,
  needs_contact_review BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at BIGINT,
  archived_by TEXT,
  notes TEXT,
  -- AI-extracted profile fields populated by the candidate-pipeline
  -- workflow's CV extractor. All nullable: rows pre-AI or with extraction
  -- failures keep null and the UI falls back to attachment metadata.
  location TEXT,
  headline TEXT,
  summary TEXT,
  years_of_experience INTEGER,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  highest_degree TEXT,
  profile_source TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_candidate_org_normalized_email
  ON hr_candidate (organization_id, normalized_email)
  WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS hr_candidate_org_archived
  ON hr_candidate (organization_id, archived_at);
CREATE INDEX IF NOT EXISTS hr_candidate_org_display_name
  ON hr_candidate (organization_id, display_name);

-- ---------------------------------------------------------------------------
-- Applications (Candidate × Position)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_application (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES hr_candidate(id) ON DELETE CASCADE,
  position_id TEXT NOT NULL REFERENCES hr_position(id) ON DELETE CASCADE,
  -- Stage maps 1:1 to the candidate-pipeline workflow nodes so the UI and
  -- the durable run never disagree about progress. See
  -- `lib/shared/hr/recruitment/types.ts` for the canonical enum.
  stage TEXT NOT NULL DEFAULT 'uploaded',
  affinity_score INTEGER,
  affinity_rationale TEXT,
  affinity_signals JSONB,
  affinity_model TEXT,
  cv_attachment_id TEXT,
  cv_text TEXT,
  -- Snapshot of the CV embedding at the moment of application creation.
  -- Frozen with the application so re-extracting the candidate row
  -- later (newer CV) never rewrites historical scoring inputs.
  cv_embedding JSONB,
  cv_embedding_model TEXT,
  -- Snapshot of the AI-extracted candidate profile at the moment this
  -- application was created. Lets the UI explain WHY the candidate
  -- ranked the way they did even if the candidate row gets re-extracted
  -- later from a newer CV.
  ai_profile_snapshot JSONB,
  ai_signals JSONB,
  -- Workflow run id is captured the moment the candidate-pipeline workflow
  -- starts. Used for cross-referencing in the workflow inspector and for
  -- defensive guards when retrying / aborting.
  workflow_run_id TEXT,
  last_transition_at BIGINT,
  last_error TEXT,
  rejection_reason TEXT,
  hired_at BIGINT,
  archived_at BIGINT,
  archived_by TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_application_stage_check CHECK (
    stage IN (
      'uploaded',
      'scoring',
      'awaiting_test',
      'evaluating',
      'awaiting_verification',
      'advanced',
      'rejected',
      'hired'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_application_position_candidate
  ON hr_application (position_id, candidate_id);
CREATE INDEX IF NOT EXISTS hr_application_org_position_score
  ON hr_application (organization_id, position_id, affinity_score DESC);
CREATE INDEX IF NOT EXISTS hr_application_org_stage
  ON hr_application (organization_id, stage);
CREATE INDEX IF NOT EXISTS hr_application_org_candidate
  ON hr_application (organization_id, candidate_id);
CREATE INDEX IF NOT EXISTS hr_application_workflow_run
  ON hr_application (workflow_run_id) WHERE workflow_run_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Evaluation dispatches and responses
--
-- Evaluation catalog ids are sourced from the hardcoded catalog in
-- `lib/shared/hr/recruitment/evaluation-catalog.ts` (e.g.
-- `screening-technical-v1`). The dispatcher persists the signed
-- completion URL on the row so the candidates UI can surface a "Take
-- evaluation" link inline; future email channels reuse the same URL.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_evaluation_dispatch (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES hr_application(id) ON DELETE CASCADE,
  -- Catalog id from `lib/shared/hr/recruitment/evaluation-catalog.ts`.
  -- No FK; the catalog lives in code, not in a table.
  evaluation_catalog_id TEXT NOT NULL,
  -- Vehicle used to hand the evaluation to the candidate. Today only
  -- `inline_link` exists (admin clicks the URL stored on this row);
  -- email/SMS adapters land later behind the same dispatcher.
  dispatched_via TEXT NOT NULL DEFAULT 'inline_link',
  status TEXT NOT NULL DEFAULT 'sent',
  -- Hook token used by the workflow's `resumeHook(...)` call when the
  -- candidate completes the evaluation. Storing it here keeps the
  -- workflow SDK out of the HTTP layer.
  resume_hook_token TEXT,
  -- Idempotency key for retry-safe dispatches. Steps record this before
  -- performing the side effect; a replay of the same step short-circuits
  -- if the key already exists.
  idempotency_key TEXT NOT NULL,
  -- Signed URL persisted at dispatch time so the UI can surface it
  -- inline and any future email adapter reuses the exact same URL.
  completion_url TEXT,
  expires_at BIGINT,
  dispatched_at BIGINT NOT NULL,
  completed_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_evaluation_dispatch_status_check CHECK (
    status IN ('sent', 'completed', 'expired', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_evaluation_dispatch_idempotency
  ON hr_evaluation_dispatch (organization_id, idempotency_key);
CREATE INDEX IF NOT EXISTS hr_evaluation_dispatch_org_application
  ON hr_evaluation_dispatch (organization_id, application_id);
CREATE INDEX IF NOT EXISTS hr_evaluation_dispatch_status
  ON hr_evaluation_dispatch (organization_id, status);

CREATE TABLE IF NOT EXISTS hr_evaluation_response (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  dispatch_id TEXT NOT NULL REFERENCES hr_evaluation_dispatch(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES hr_application(id) ON DELETE CASCADE,
  -- Submitted answers. Shape mirrors the catalog questions JSON.
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Computed score 0..100 from the catalog scorer. Null while pending.
  score INTEGER,
  -- Auto/Manual signal. Manual entries reflect a human reviewer override.
  scored_by TEXT NOT NULL DEFAULT 'auto',
  passed BOOLEAN,
  submitted_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_evaluation_response_scored_by_check CHECK (
    scored_by IN ('auto', 'manual', 'pending')
  )
);

CREATE INDEX IF NOT EXISTS hr_evaluation_response_org_application
  ON hr_evaluation_response (organization_id, application_id);
CREATE INDEX IF NOT EXISTS hr_evaluation_response_dispatch
  ON hr_evaluation_response (dispatch_id);

-- ---------------------------------------------------------------------------
-- Background checks (separate addon; rows only created when the workflow
-- branches into the verification stage AND the org has the addon).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_background_check (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES hr_application(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES hr_candidate(id) ON DELETE CASCADE,
  -- Provider key. `mock` is the only supported value today; real adapters
  -- (e.g. checkr, transunion) plug in behind the same service.
  provider TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL DEFAULT 'pending',
  passed BOOLEAN,
  credit_score INTEGER,
  legal_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Raw provider payload retained verbatim for audit. The mock provider
  -- writes a believable shape so future real implementations have a clear
  -- migration target.
  raw_payload JSONB,
  resume_webhook_url TEXT,
  idempotency_key TEXT NOT NULL,
  requested_at BIGINT NOT NULL,
  completed_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT hr_background_check_status_check CHECK (
    status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_background_check_idempotency
  ON hr_background_check (organization_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS hr_background_check_application
  ON hr_background_check (application_id);
CREATE INDEX IF NOT EXISTS hr_background_check_org_status
  ON hr_background_check (organization_id, status);
