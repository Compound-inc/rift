import { defineMutatorsWithType } from '@rocicorp/zero'
import type { Schema } from './schema'
import { chatMutatorDefinitions } from './mutators/chat.mutators'
import { orgProductFeaturesMutatorDefinitions } from './mutators/org-product-features.mutators'
import { orgProductPolicyMutatorDefinitions } from './mutators/org-product-policy.mutators'
import { orgPolicyMutatorDefinitions } from './mutators/org-policy.mutators'

/**
 * Workspace-wide Zero mutators composed from feature-scoped modules.
 * Keep this file as a registry so domains can evolve independently.
 */
export const mutators = defineMutatorsWithType<Schema>()({
  ...chatMutatorDefinitions,
  ...orgProductFeaturesMutatorDefinitions,
  ...orgProductPolicyMutatorDefinitions,
  ...orgPolicyMutatorDefinitions,
})
