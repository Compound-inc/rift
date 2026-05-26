/**
 * Authorization decision for "may caller edit this skill?". Single source
 * of truth shared by the Zero mutator (`assertSkillEditable`) and the
 * page-level UI gate (`canEditSkill`); both adapt to it so the two cannot
 * drift.
 *
 * Rule (ADR-0005):
 *   1. Soft-deleted skill          → `not_found`
 *   2. Project Skill               → defer to project access (project
 *      owner only; skill's own `userId` is ignored on this branch).
 *   3. Personal/Org-Shared, caller is creator      → allowed
 *   4. Org-Shared with `allowAdminEdit`, caller is admin of the
 *      owning org                                  → allowed
 *   5. Otherwise                                   → `not_owned`
 */
import {
  PROJECT_ACCESS_FAILURE_CODE
} from '@/lib/shared/projects/access'
import type { ProjectAccessResult } from '@/lib/shared/projects/access'
import { isAdminRole } from '@/lib/shared/auth/roles'

import { SKILL_ERROR_CODE } from './skill-grammar'
import type { SkillRow } from './skill-row'

export type SkillEditCaller = {
  readonly userId: string | undefined
  readonly activeOrganizationId: string | null | undefined
  readonly activeOrganizationRole: string | null | undefined
}

export type SkillEditSubject = Pick<
  SkillRow,
  'userId' | 'projectId' | 'organizationId' | 'allowAdminEdit' | 'deletedAt'
>

export type SkillEditDecision =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'denied'; readonly errorCode: string }

/**
 * Project access result for project-scoped skills. Server runs
 * `checkProjectAccess` against the fetched project row; client runs it
 * against the row loaded via Zero. `undefined` for a project-scoped
 * skill is treated as project-not-found.
 */
export type SkillProjectAccess = ProjectAccessResult<{
  readonly id: string
  readonly userId: string
  readonly organizationId?: string | null
  readonly deletedAt?: number | null
}>

export function decideSkillEdit(input: {
  readonly skill: SkillEditSubject
  readonly caller: SkillEditCaller
  readonly projectAccess?: SkillProjectAccess
}): SkillEditDecision {
  const { skill, caller, projectAccess } = input

  if (skill.deletedAt) {
    return { kind: 'denied', errorCode: SKILL_ERROR_CODE.notFound }
  }

  if (!caller.userId) {
    return { kind: 'denied', errorCode: SKILL_ERROR_CODE.requiresAuth }
  }

  if (skill.projectId) {
    if (!projectAccess) {
      return {
        kind: 'denied',
        errorCode: PROJECT_ACCESS_FAILURE_CODE['not-found'],
      }
    }
    if (projectAccess.kind === 'ok') return { kind: 'allowed' }
    return {
      kind: 'denied',
      errorCode:
        PROJECT_ACCESS_FAILURE_CODE[projectAccess.kind] ??
        SKILL_ERROR_CODE.projectAccessFailure,
    }
  }

  if (skill.userId === caller.userId) return { kind: 'allowed' }

  // Admin co-edit requires the caller's active org to match the skill's
  // owning org — admin of a different org is no help.
  if (
    skill.organizationId &&
    skill.allowAdminEdit &&
    caller.activeOrganizationId === skill.organizationId &&
    caller.activeOrganizationRole &&
    isAdminRole(caller.activeOrganizationRole)
  ) {
    return { kind: 'allowed' }
  }

  return { kind: 'denied', errorCode: SKILL_ERROR_CODE.notOwned }
}
