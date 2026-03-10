-- Drop Zero publication and app tables for dev reset.
-- Run via db:reset or zero:reset (scripts/db-reset.ts, scripts/zero-dev-reset.ts).
-- Do not use as a forward migration.

DROP PUBLICATION IF EXISTS zero_data;

DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS threads;
DROP TABLE IF EXISTS org_ai_policy;
DROP TABLE IF EXISTS org_topup_grant_ledger;
DROP TABLE IF EXISTS org_topup_grant;
DROP TABLE IF EXISTS org_topup_order;
DROP TABLE IF EXISTS topup_product;
DROP TABLE IF EXISTS org_member_access;
DROP TABLE IF EXISTS org_entitlement_snapshot;
DROP TABLE IF EXISTS org_subscription;
DROP TABLE IF EXISTS org_billing_account;
DROP TABLE IF EXISTS subscription;
