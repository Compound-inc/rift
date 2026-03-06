import { defineQueriesWithType } from '@rocicorp/zero'
import type { Schema } from './schema'
import { chatQueryDefinitions } from './queries/chat.queries'
import { orgSettingsQueryDefinitions } from './queries/org-settings.queries'
import { orgPolicyQueryDefinitions } from './queries/org-policy.queries'

/**
 * Workspace-wide Zero queries composed from feature-scoped modules.
 * Keep this file as a thin registry to avoid unbounded growth.
 */
export const queries = defineQueriesWithType<Schema>()({
  ...chatQueryDefinitions,
  ...orgSettingsQueryDefinitions,
  ...orgPolicyQueryDefinitions,
})
