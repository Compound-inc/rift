-- Drop Zero publication and all app tables for a full dev reset.
-- Run only via scripts/zero-dev-reset.ts against ZERO_UPSTREAM_DB.
-- Do not use as a forward migration.

DROP PUBLICATION IF EXISTS zero_data;

DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS threads;
DROP TABLE IF EXISTS org_ai_policy;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS users;
