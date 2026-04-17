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
