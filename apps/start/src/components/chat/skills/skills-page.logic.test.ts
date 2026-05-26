import { toast } from 'sonner'
import { describe, expect, it, vi } from 'vitest'

import { SKILL_ERROR_CODE } from '@/lib/shared/skills/skill-grammar'

import {
  canEditSkill,
  describeSkillError,
  runSkillMutation,
} from './skills-page.logic'
import type { SkillEditContext, SkillRow } from './skills-page.logic'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('describeSkillError', () => {
  it.each(Object.values(SKILL_ERROR_CODE))(
    'maps %s to a non-empty message',
    (code) => {
      const message = describeSkillError(new Error(code))
      expect(message).toBeTruthy()
      expect(typeof message).toBe('string')
    },
  )

  it('also maps the project-access codes raised through PROJECT_ACCESS_FAILURE_CODE', () => {
    expect(describeSkillError(new Error('project_not_found_or_deleted')))
      .toBeTruthy()
    expect(describeSkillError(new Error('project_not_owned'))).toBeTruthy()
  })

  it('falls through to a generic message for unknown codes', () => {
    expect(describeSkillError(new Error('something_unexpected'))).toBeTruthy()
    expect(describeSkillError('not even an Error')).toBeTruthy()
  })
})

describe('runSkillMutation', () => {
  it('returns true when the mutation resolves', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    expect(await runSkillMutation({ fn })).toBe(true)
  })

  it('emits a success toast when a `successMessage` is provided', async () => {
    const successSpy = vi.mocked(toast.success)
    successSpy.mockClear()
    await runSkillMutation({
      fn: () => Promise.resolve(),
      successMessage: 'Done',
    })
    expect(successSpy).toHaveBeenCalledWith('Done')
  })

  it('returns false and emits an error toast when the mutation throws', async () => {
    const errorSpy = vi.mocked(toast.error)
    errorSpy.mockClear()
    const ok = await runSkillMutation({
      fn: () => Promise.reject(new Error(SKILL_ERROR_CODE.notOwned)),
    })
    expect(ok).toBe(false)
    expect(errorSpy).toHaveBeenCalledOnce()
  })

  it('treats a Zero MutatorResultDetails error result as a failure', async () => {
    // Zero `.client` / `.server` promises do NOT reject on app errors —
    // they resolve with `{ type: 'error', error: { type: 'app', message } }`.
    // runSkillMutation must inspect this shape; otherwise the call appears
    // to succeed and the user sees a silently-broken UI.
    const errorSpy = vi.mocked(toast.error)
    errorSpy.mockClear()
    const ok = await runSkillMutation({
      fn: () =>
        Promise.resolve({
          type: 'error',
          error: {
            type: 'app',
            message: SKILL_ERROR_CODE.shareConflict,
            details: undefined,
          },
        }),
    })
    expect(ok).toBe(false)
    expect(errorSpy).toHaveBeenCalledOnce()
  })

  it('treats a Zero MutatorResultDetails success result as success', async () => {
    const successSpy = vi.mocked(toast.success)
    successSpy.mockClear()
    const ok = await runSkillMutation({
      fn: () => Promise.resolve({ type: 'success' }),
      successMessage: 'Done',
    })
    expect(ok).toBe(true)
    expect(successSpy).toHaveBeenCalledWith('Done')
  })
})

describe('canEditSkill', () => {
  // Concise factories so each assertion focuses on the auth-rule branch
  // it cares about. Defaults represent the simplest valid case (a
  // signed-in member of an org with no special role).
  const baseContext: SkillEditContext = {
    currentUserId: 'user-1',
    activeOrganizationId: 'org-1',
    activeOrganizationRole: 'member',
    project: undefined,
  }
  const personalSkill: SkillRow = {
    id: 'skill-1',
    userId: 'user-1',
    organizationId: null,
    projectId: null,
    name: 'refactor',
    body: 'Refactor:',
    description: null,
    allowAdminEdit: false,
    deletedAt: null,
  }

  // Helper for the project-skill cases below — builds the minimal
  // project row shape that `checkProjectAccess` consumes. The skill's
  // own creator userId is irrelevant on the project branch (project
  // owner is the single permission anchor).
  const makeProject = (ownerUserId: string) => ({
    id: 'project-1',
    userId: ownerUserId,
    organizationId: null,
    deletedAt: null,
  })

  it('lets the creator edit their personal skill', () => {
    expect(
      canEditSkill({ skill: personalSkill, context: baseContext }),
    ).toBe(true)
  })

  it('blocks anonymous callers (no currentUserId)', () => {
    expect(
      canEditSkill({
        skill: personalSkill,
        context: { ...baseContext, currentUserId: undefined },
      }),
    ).toBe(false)
  })

  it('blocks a non-creator on someone else’s personal skill', () => {
    expect(
      canEditSkill({
        skill: { ...personalSkill, userId: 'user-2' },
        context: baseContext,
      }),
    ).toBe(false)
  })

  it('uses project ownership — not skill creator — for Project Skills', () => {
    const projectSkill: SkillRow = {
      ...personalSkill,
      projectId: 'project-1',
      // Even when the caller is the listed creator, project ownership
      // is the only check that matters on this branch.
      userId: 'user-1',
    }
    expect(
      canEditSkill({
        skill: projectSkill,
        context: { ...baseContext, project: makeProject('user-2') },
      }),
    ).toBe(false)
    expect(
      canEditSkill({
        skill: projectSkill,
        context: { ...baseContext, project: makeProject('user-1') },
      }),
    ).toBe(true)
  })

  it('lets org admins co-edit Org-Shared skills only when allowAdminEdit is true', () => {
    const sharedSkill: SkillRow = {
      ...personalSkill,
      userId: 'user-2',
      organizationId: 'org-1',
      allowAdminEdit: false,
    }
    const adminContext: SkillEditContext = {
      ...baseContext,
      activeOrganizationRole: 'admin',
    }
    expect(canEditSkill({ skill: sharedSkill, context: adminContext })).toBe(
      false,
    )
    expect(
      canEditSkill({
        skill: { ...sharedSkill, allowAdminEdit: true },
        context: adminContext,
      }),
    ).toBe(true)
  })

  it('rejects admin co-edit when the active org does not match the skill’s org', () => {
    expect(
      canEditSkill({
        skill: {
          ...personalSkill,
          userId: 'user-2',
          organizationId: 'org-1',
          allowAdminEdit: true,
        },
        context: {
          ...baseContext,
          activeOrganizationId: 'org-2',
          activeOrganizationRole: 'admin',
        },
      }),
    ).toBe(false)
  })

  it('rejects co-edit when the caller is a plain member of the skill’s org', () => {
    expect(
      canEditSkill({
        skill: {
          ...personalSkill,
          userId: 'user-2',
          organizationId: 'org-1',
          allowAdminEdit: true,
        },
        context: { ...baseContext, activeOrganizationRole: 'member' },
      }),
    ).toBe(false)
  })
})
