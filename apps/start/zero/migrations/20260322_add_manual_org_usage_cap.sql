ALTER TABLE org_usage_policy_override
  ADD COLUMN IF NOT EXISTS organization_monthly_budget_nano_usd BIGINT;
