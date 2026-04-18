import { defineQueriesWithType } from '@rocicorp/zero'
import type { Schema } from './schema'
import { chatQueryDefinitions } from './queries/chat.queries'
import { orgBillingQueryDefinitions } from './queries/org-billing.queries'
import { orgKnowledgeQueryDefinitions } from './queries/org-knowledge.queries'
import { orgProductFeaturesQueryDefinitions } from './queries/org-product-features.queries'
import { orgProductPolicyQueryDefinitions } from './queries/org-product-policy.queries'
import { orgSettingsQueryDefinitions } from './queries/org-settings.queries'
import { orgPolicyQueryDefinitions } from './queries/org-policy.queries'
import { writingQueryDefinitions } from './queries/writing.queries'

/**
 * Workspace-wide Zero queries composed from feature-scoped modules.
 * Keep this file as a thin registry to avoid unbounded growth.
 */
export const queries = defineQueriesWithType<Schema>()({
  ...chatQueryDefinitions,
  ...orgBillingQueryDefinitions,
  ...orgKnowledgeQueryDefinitions,
  ...orgProductFeaturesQueryDefinitions,
  ...orgProductPolicyQueryDefinitions,
  ...orgSettingsQueryDefinitions,
  ...orgPolicyQueryDefinitions,
  ...writingQueryDefinitions,
})
