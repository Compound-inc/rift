-- Adds organization-owned billing foundations: subscriptions,
-- entitlement snapshots, and seat access controls.

CREATE TABLE IF NOT EXISTS org_billing_account (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS org_billing_account_organization_id
  ON org_billing_account (organization_id);

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
CREATE INDEX IF NOT EXISTS org_subscription_organization_id
  ON org_subscription (organization_id);
CREATE INDEX IF NOT EXISTS org_subscription_billing_account_id
  ON org_subscription (billing_account_id);
CREATE INDEX IF NOT EXISTS org_subscription_status
  ON org_subscription (status);

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
  computed_at BIGINT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);

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
CREATE UNIQUE INDEX IF NOT EXISTS org_member_access_org_user
  ON org_member_access (organization_id, user_id);
CREATE INDEX IF NOT EXISTS org_member_access_status
  ON org_member_access (status);

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
CREATE INDEX IF NOT EXISTS subscription_reference_id
  ON subscription ("referenceId");
CREATE INDEX IF NOT EXISTS subscription_stripe_subscription_id
  ON subscription ("stripeSubscriptionId");

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

INSERT INTO org_billing_account (
  id,
  organization_id,
  provider,
  status,
  created_at,
  updated_at
)
SELECT
  'billing_' || organization.id,
  organization.id,
  'manual',
  'active',
  extract(epoch from now())::bigint * 1000,
  extract(epoch from now())::bigint * 1000
FROM organization
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO org_entitlement_snapshot (
  organization_id,
  plan_id,
  billing_provider,
  subscription_status,
  seat_count,
  active_member_count,
  pending_invitation_count,
  is_over_seat_limit,
  effective_features,
  usage_policy,
  computed_at,
  version
)
SELECT
  organization.id,
  'free',
  'manual',
  'inactive',
  1,
  coalesce(member_counts.active_member_count, 0),
  coalesce(invitation_counts.pending_invitation_count, 0),
  (coalesce(member_counts.active_member_count, 0) > 1)
    or ((coalesce(member_counts.active_member_count, 0) + coalesce(invitation_counts.pending_invitation_count, 0)) > 1),
  '{}'::jsonb,
  '{}'::jsonb,
  extract(epoch from now())::bigint * 1000,
  1
FROM organization
LEFT JOIN (
  SELECT "organizationId", count(*)::int as active_member_count
  FROM member
  GROUP BY "organizationId"
) member_counts
  ON member_counts."organizationId" = organization.id
LEFT JOIN (
  SELECT "organizationId", count(*)::int as pending_invitation_count
  FROM invitation
  WHERE status = 'pending'
  GROUP BY "organizationId"
) invitation_counts
  ON invitation_counts."organizationId" = organization.id
ON CONFLICT (organization_id) DO NOTHING;
