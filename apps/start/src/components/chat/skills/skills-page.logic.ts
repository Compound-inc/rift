/**
 * Page-shared logic: error mapping, mutation result wrapping, and the
 * client-side `canEditSkill` adapter over the shared `decideSkillEdit`.
 */
import { toast } from 'sonner'

import { checkProjectAccess } from '@/lib/shared/projects/access'
import type { ProjectAccessSubject } from '@/lib/shared/projects/access'
import { decideSkillEdit } from '@/lib/shared/skills/skill-edit-policy'
import { SKILL_ERROR_CODE, SKILL_LIMITS } from '@/lib/shared/skills/skill-grammar'
import type { SkillRow } from '@/lib/shared/skills/skill-row'
import { m } from '@/paraglide/messages.js'

// Re-exported so leaf components stay on a flat import surface.
export type { SkillRow }

export type SkillEditContext = {
  readonly currentUserId: string | undefined
  readonly activeOrganizationId: string | null | undefined
  readonly activeOrganizationRole: string | null | undefined
  /**
   * Pre-loaded project row. `null`/`undefined` is treated by the
   * policy as project-not-found-or-deleted (correct for both "page
   * never loads a project" and "project failed to load").
   */
  readonly project: ProjectAccessSubject | null | undefined
}

/**
 * Adapter over `decideSkillEdit` for the UI: builds the project-access
 * result from the page's loaded project and returns a plain boolean.
 * Callers needing the denial reason can use `decideSkillEdit` directly.
 */
export function canEditSkill(input: {
  readonly skill: Pick<
    SkillRow,
    'userId' | 'projectId' | 'organizationId' | 'allowAdminEdit' | 'deletedAt'
  >
  readonly context: SkillEditContext
}): boolean {
  const { skill, context } = input

  if (!context.currentUserId) return false

  const projectAccess = skill.projectId
    ? checkProjectAccess(context.project, { userId: context.currentUserId })
    : undefined

  return (
    decideSkillEdit({
      skill,
      caller: {
        userId: context.currentUserId,
        activeOrganizationId: context.activeOrganizationId,
        activeOrganizationRole: context.activeOrganizationRole,
      },
      projectAccess,
    }).kind === 'allowed'
  )
}

/** Maps a stable error code from the mutators to a localised UI string. */
export function describeSkillError(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error)
  switch (code) {
    case SKILL_ERROR_CODE.nameInvalid:
      return m.chat_skill_error_name_invalid()
    case SKILL_ERROR_CODE.nameTaken:
      return m.chat_skill_error_name_taken()
    case SKILL_ERROR_CODE.bodyEmpty:
      return m.chat_skill_error_body_empty()
    case SKILL_ERROR_CODE.bodyTooLong:
      return m.chat_skill_error_body_too_long({ max: SKILL_LIMITS.bodyMax })
    case SKILL_ERROR_CODE.notFound:
      return m.chat_skill_error_not_found()
    case SKILL_ERROR_CODE.notOwned:
      return m.chat_skill_error_not_owned()
    case SKILL_ERROR_CODE.requiresAuth:
      return m.chat_skill_error_requires_auth()
    case SKILL_ERROR_CODE.shareRequiresOrg:
      return m.chat_skill_error_share_requires_org()
    case SKILL_ERROR_CODE.shareConflict:
      return m.chat_skill_error_share_conflict()
    case SKILL_ERROR_CODE.projectAccessFailure:
    case 'project_not_found_or_deleted':
    case 'project_not_owned':
      return m.chat_skill_error_project_access()
    default:
      return m.chat_skill_error_generic()
  }
}

/**
 * Wraps a skill-mutator call. Zero's `.client`/`.server` promises do
 * NOT reject on app errors — they resolve with a `MutatorResultDetails`
 * object whose `type` is `'success'` or `'error'`. We inspect that
 * shape here so callers can stay on a boolean return.
 *
 * Returns true on success so callers can branch (e.g. close a dialog).
 */
export async function runSkillMutation(input: {
  readonly fn: () => Promise<unknown>
  readonly successMessage?: string
}): Promise<boolean> {
  try {
    const result = await input.fn()
    if (isMutatorErrorResult(result)) {
      console.error('[skills] mutator returned error result', result.error)
      toast.error(describeSkillError(new Error(result.error.message)))
      return false
    }
    if (input.successMessage) toast.success(input.successMessage)
    return true
  } catch (error) {
    console.error('[skills] mutator threw', error)
    toast.error(describeSkillError(error))
    return false
  }
}

function isMutatorErrorResult(
  result: unknown,
): result is { readonly type: 'error'; readonly error: { readonly message: string } } {
  if (!result || typeof result !== 'object') return false
  const candidate = result as { type?: unknown; error?: unknown }
  if (candidate.type !== 'error') return false
  const error = candidate.error as { message?: unknown } | undefined
  return typeof error?.message === 'string'
}
