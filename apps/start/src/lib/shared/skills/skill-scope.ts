/**
 * Three-way scope for skills, derived from the `(projectId, organizationId)`
 * pair on a row (ADR-0005). `projectId` wins when both are set — Project
 * Skills are gated by the project's audience even when an `organizationId`
 * is carried for attribution.
 *
 *   projectId set                          → 'project'
 *   projectId null, organizationId set     → 'shared'
 *   both null                              → 'personal'
 */
import type { SkillRow } from './skill-row'

export type SkillScope = 'personal' | 'project' | 'shared'

/**
 * Resolution priority for the chain `Project > Org-Shared > Personal`.
 * Higher number wins when two scopes carry the same canonical name.
 */
export const SCOPE_PRIORITY: Readonly<Record<SkillScope, number>> = {
  project: 3,
  shared: 2,
  personal: 1,
}

export function getSkillScope(
  skill: Pick<SkillRow, 'projectId' | 'organizationId'>,
): SkillScope {
  if (skill.projectId) return 'project'
  if (skill.organizationId) return 'shared'
  return 'personal'
}
