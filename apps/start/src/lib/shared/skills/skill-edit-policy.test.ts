import { describe, expect, it } from 'vitest'

import { PROJECT_ACCESS_FAILURE_CODE } from '@/lib/shared/projects/access'

import { SKILL_ERROR_CODE } from './skill-grammar'
import {
  
  
  decideSkillEdit
} from './skill-edit-policy'
import type {SkillEditCaller, SkillEditSubject} from './skill-edit-policy';

/**
 * The decision function is the single authority for "may caller edit
 * this skill?". The mutator and the UI both consume it; these tests
 * lock the rule down so a regression in either consumer surfaces here
 * first instead of as a 500 in production.
 *
 * Branches covered (one per ADR-0005 rule):
 *   - soft-deleted              → not_found
 *   - anonymous caller          → requires_auth
 *   - project skill, owner      → allowed
 *   - project skill, non-owner  → project_not_owned
 *   - project skill, no project → project_not_found_or_deleted
 *   - personal, creator         → allowed
 *   - personal, non-creator     → not_owned
 *   - org-shared, creator       → allowed
 *   - org-shared with allowAdminEdit, admin of same org    → allowed
 *   - org-shared with allowAdminEdit, admin of different org → not_owned
 *   - org-shared with allowAdminEdit, plain member         → not_owned
 *   - org-shared without allowAdminEdit, admin              → not_owned
 */

const makeCaller = (over: Partial<SkillEditCaller> = {}): SkillEditCaller => ({
  userId: 'user-1',
  activeOrganizationId: 'org-1',
  activeOrganizationRole: 'member',
  ...over,
})

const makeSkill = (over: Partial<SkillEditSubject> = {}): SkillEditSubject => ({
  userId: 'user-1',
  organizationId: null,
  projectId: null,
  allowAdminEdit: false,
  deletedAt: null,
  ...over,
})

describe('decideSkillEdit', () => {
  it('denies edits to a soft-deleted skill, even for the creator', () => {
    expect(
      decideSkillEdit({
        skill: makeSkill({ deletedAt: 1 }),
        caller: makeCaller(),
      }),
    ).toEqual({ kind: 'denied', errorCode: SKILL_ERROR_CODE.notFound })
  })

  it('denies anonymous callers', () => {
    expect(
      decideSkillEdit({
        skill: makeSkill(),
        caller: makeCaller({ userId: undefined }),
      }),
    ).toEqual({
      kind: 'denied',
      errorCode: SKILL_ERROR_CODE.requiresAuth,
    })
  })

  it('allows the creator to edit a personal skill', () => {
    expect(
      decideSkillEdit({
        skill: makeSkill(),
        caller: makeCaller(),
      }),
    ).toEqual({ kind: 'allowed' })
  })

  it('denies a non-creator on a personal skill', () => {
    expect(
      decideSkillEdit({
        skill: makeSkill({ userId: 'user-2' }),
        caller: makeCaller(),
      }),
    ).toEqual({ kind: 'denied', errorCode: SKILL_ERROR_CODE.notOwned })
  })

  it('uses project ownership — not skill creator — for project skills', () => {
    const subject = makeSkill({ projectId: 'project-1' })
    expect(
      decideSkillEdit({
        skill: subject,
        caller: makeCaller(),
        projectAccess: {
          kind: 'ok',
          project: {
            id: 'project-1',
            userId: 'user-1',
            organizationId: null,
            deletedAt: null,
          },
        },
      }),
    ).toEqual({ kind: 'allowed' })
  })

  it('denies project-skill edits when the caller does not own the project', () => {
    expect(
      decideSkillEdit({
        skill: makeSkill({ projectId: 'project-1' }),
        caller: makeCaller(),
        projectAccess: { kind: 'not-owned' },
      }),
    ).toEqual({
      kind: 'denied',
      errorCode: PROJECT_ACCESS_FAILURE_CODE['not-owned'],
    })
  })

  it('treats a missing project as project-not-found, not crash', () => {
    // Defensive: a project-scoped skill whose project the caller could
    // not load (deleted, sync race, etc.). Without this branch the
    // decision would silently fall through to the personal-skill
    // creator check, which would be wrong.
    expect(
      decideSkillEdit({
        skill: makeSkill({ projectId: 'project-1' }),
        caller: makeCaller(),
        projectAccess: undefined,
      }),
    ).toEqual({
      kind: 'denied',
      errorCode: PROJECT_ACCESS_FAILURE_CODE['not-found'],
    })
  })

  it('lets org admins co-edit Org-Shared skills only when allowAdminEdit is on', () => {
    const sharedSubject = makeSkill({
      userId: 'user-2',
      organizationId: 'org-1',
      allowAdminEdit: false,
    })
    const adminCaller = makeCaller({ activeOrganizationRole: 'admin' })
    expect(
      decideSkillEdit({ skill: sharedSubject, caller: adminCaller }),
    ).toEqual({ kind: 'denied', errorCode: SKILL_ERROR_CODE.notOwned })
    expect(
      decideSkillEdit({
        skill: { ...sharedSubject, allowAdminEdit: true },
        caller: adminCaller,
      }),
    ).toEqual({ kind: 'allowed' })
  })

  it('rejects admin co-edit when the active org does not match', () => {
    expect(
      decideSkillEdit({
        skill: makeSkill({
          userId: 'user-2',
          organizationId: 'org-1',
          allowAdminEdit: true,
        }),
        caller: makeCaller({
          activeOrganizationId: 'org-2',
          activeOrganizationRole: 'admin',
        }),
      }),
    ).toEqual({ kind: 'denied', errorCode: SKILL_ERROR_CODE.notOwned })
  })

  it('rejects co-edit when the caller is a plain member', () => {
    expect(
      decideSkillEdit({
        skill: makeSkill({
          userId: 'user-2',
          organizationId: 'org-1',
          allowAdminEdit: true,
        }),
        caller: makeCaller({ activeOrganizationRole: 'member' }),
      }),
    ).toEqual({ kind: 'denied', errorCode: SKILL_ERROR_CODE.notOwned })
  })
})
