import { describe, expect, it } from 'vitest'
import {
  PROJECT_ACCESS_FAILURE_CODE,
  checkProjectAccess,
} from './access'

const owner = 'user-owner'
const stranger = 'user-stranger'

const baseProject = {
  id: 'project-1',
  userId: owner,
  organizationId: undefined,
  deletedAt: undefined,
} as const

describe('checkProjectAccess', () => {
  it('returns ok when project exists and the caller owns it', () => {
    const result = checkProjectAccess(baseProject, { userId: owner })
    expect(result).toEqual({ kind: 'ok', project: baseProject })
  })

  it('returns not-found for missing project', () => {
    expect(checkProjectAccess(null, { userId: owner })).toEqual({
      kind: 'not-found',
    })
    expect(checkProjectAccess(undefined, { userId: owner })).toEqual({
      kind: 'not-found',
    })
  })

  it('reports soft-delete before ownership so deleted-but-owned still surfaces correctly', () => {
    const deletedByOwner = { ...baseProject, deletedAt: 1 }
    expect(
      checkProjectAccess(deletedByOwner, { userId: owner }),
    ).toEqual({ kind: 'soft-deleted' })

    const deletedByStranger = { ...baseProject, userId: stranger, deletedAt: 1 }
    expect(
      checkProjectAccess(deletedByStranger, { userId: owner }),
    ).toEqual({ kind: 'soft-deleted' })
  })

  it('returns not-owned for foreign owner', () => {
    expect(
      checkProjectAccess(
        { ...baseProject, userId: stranger },
        { userId: owner },
      ),
    ).toEqual({ kind: 'not-owned' })
  })

  describe('org context', () => {
    it('skips org check when orgContext.enforce is false', () => {
      const result = checkProjectAccess(
        { ...baseProject, organizationId: 'org-a' },
        {
          userId: owner,
          orgContext: { enforce: false },
        },
      )
      expect(result.kind).toBe('ok')
    })

    it('matches when project and caller agree on org id', () => {
      const result = checkProjectAccess(
        { ...baseProject, organizationId: 'org-a' },
        {
          userId: owner,
          orgContext: { enforce: true, organizationId: 'org-a' },
        },
      )
      expect(result.kind).toBe('ok')
    })

    it('matches when both have no org', () => {
      const result = checkProjectAccess(
        { ...baseProject, organizationId: undefined },
        {
          userId: owner,
          orgContext: { enforce: true, organizationId: undefined },
        },
      )
      expect(result.kind).toBe('ok')
    })

    it('treats empty / whitespace-only org ids as no org on either side', () => {
      const result = checkProjectAccess(
        { ...baseProject, organizationId: '   ' },
        {
          userId: owner,
          orgContext: { enforce: true, organizationId: '' },
        },
      )
      expect(result.kind).toBe('ok')
    })

    it('flags org mismatch when caller and project disagree', () => {
      const result = checkProjectAccess(
        { ...baseProject, organizationId: 'org-a' },
        {
          userId: owner,
          orgContext: { enforce: true, organizationId: 'org-b' },
        },
      )
      expect(result.kind).toBe('org-mismatch')
    })

    it('flags org mismatch when caller has org but project does not', () => {
      const result = checkProjectAccess(
        { ...baseProject, organizationId: undefined },
        {
          userId: owner,
          orgContext: { enforce: true, organizationId: 'org-a' },
        },
      )
      expect(result.kind).toBe('org-mismatch')
    })
  })

  it('exposes stable failure codes for Error.message encoding', () => {
    expect(PROJECT_ACCESS_FAILURE_CODE['not-found']).toBe(
      'project_not_found_or_deleted',
    )
    expect(PROJECT_ACCESS_FAILURE_CODE['soft-deleted']).toBe(
      'project_not_found_or_deleted',
    )
    expect(PROJECT_ACCESS_FAILURE_CODE['not-owned']).toBe('project_not_owned')
    expect(PROJECT_ACCESS_FAILURE_CODE['org-mismatch']).toBe(
      'project_org_mismatch',
    )
  })
})
