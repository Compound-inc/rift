DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'org_ai_policy'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'org_policy'
  ) THEN
    ALTER TABLE org_ai_policy RENAME TO org_policy;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'org_ai_policy_organization_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'org_policy_organization_id'
  ) THEN
    ALTER INDEX org_ai_policy_organization_id RENAME TO org_policy_organization_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'org_ai_policy_updated_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'org_policy_updated_at'
  ) THEN
    ALTER INDEX org_ai_policy_updated_at RENAME TO org_policy_updated_at;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'org_feature_config'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'org_product_config'
  ) THEN
    ALTER TABLE org_feature_config RENAME TO org_product_config;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'org_feature_config_organization_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'org_product_config_organization_id'
  ) THEN
    ALTER INDEX org_feature_config_organization_id RENAME TO org_product_config_organization_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'org_feature_config_updated_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'org_product_config_updated_at'
  ) THEN
    ALTER INDEX org_feature_config_updated_at RENAME TO org_product_config_updated_at;
  END IF;
END
$$;
