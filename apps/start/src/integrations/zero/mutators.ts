import { defineMutatorsWithType } from '@rocicorp/zero'
import type { Schema } from './schema'
import { chatMutatorDefinitions } from './mutators/chat.mutators'
import { orgPolicyMutatorDefinitions } from './mutators/org-policy.mutators'
import { projectMutatorDefinitions } from './mutators/projects.mutators'
import { skillMutatorDefinitions } from './mutators/skills.mutators'

/**
 * Workspace-wide Zero mutators composed from feature-scoped modules.
 * Keep this file as a registry so domains can evolve independently.
 */
export const mutators = defineMutatorsWithType<Schema>()({
  ...chatMutatorDefinitions,
  ...orgPolicyMutatorDefinitions,
  ...projectMutatorDefinitions,
  ...skillMutatorDefinitions,
})
