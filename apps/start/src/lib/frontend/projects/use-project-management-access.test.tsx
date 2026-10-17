// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resetProjectMembershipCache,
  useProjectManagementAccess,
} from './use-project-management-access'

const { auth, memberships } = vi.hoisted(() => ({
  auth: {
    user: { id: 'owner' },
    isAnonymous: false,
    activeOrganizationId: 'org',
  },
  memberships: vi.fn(),
}))
vi.mock('@/lib/frontend/auth/use-auth', () => ({ useAppAuth: () => auth }))
vi.mock('./project-owner.functions', () => ({
  getProjectOwnerMemberships: memberships,
}))

const project = {
  id: 'p',
  userId: 'owner',
  organizationId: 'org',
  visibility: 'org' as const,
}
beforeEach(() => {
  resetProjectMembershipCache()
  memberships.mockReset()
  auth.user = { id: 'owner' }
  auth.activeOrganizationId = 'org'
  auth.isAnonymous = false
})
afterEach(cleanup)

describe('project management membership projection', () => {
  it('makes departed-workspace projects read-only while preserving private owner management', async () => {
    memberships.mockResolvedValue([])
    const { result } = renderHook(useProjectManagementAccess)
    await waitFor(() => expect(result.current.isOrphan(project)).toBe(true))
    expect(result.current.canManage(project)).toBe(false)
    expect(
      result.current.canManage({ ...project, visibility: 'private' }),
    ).toBe(true)
    expect(result.current.canManage({ ...project, userId: 'other' })).toBe(
      false,
    )
    memberships.mockResolvedValue(['org'])
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(result.current.canManage(project)).toBe(true))
  })

  it('does not apply an old identity’s pending response after a workspace switch', async () => {
    let finishOld!: (orgs: string[]) => void
    memberships.mockImplementationOnce(
      () =>
        new Promise<string[]>((resolve) => {
          finishOld = resolve
        }),
    )
    memberships.mockResolvedValue(['org'])
    const { result, rerender } = renderHook(useProjectManagementAccess)
    auth.activeOrganizationId = 'other-org'
    rerender()
    await waitFor(() => expect(memberships).toHaveBeenCalledTimes(2))
    await act(async () => {
      finishOld([])
    })
    expect(result.current.isOrphan(project)).toBe(false)
  })

  it('shares one in-flight membership request between mounted controls', async () => {
    memberships.mockResolvedValue(['org'])
    renderHook(useProjectManagementAccess)
    renderHook(useProjectManagementAccess)
    renderHook(useProjectManagementAccess)
    await waitFor(() => expect(memberships).toHaveBeenCalledTimes(1))
  })

  it('keeps known removal when a membership refresh fails', async () => {
    memberships.mockResolvedValue([])
    const { result } = renderHook(useProjectManagementAccess)
    await waitFor(() => expect(result.current.isOrphan(project)).toBe(true))
    memberships.mockRejectedValue(new Error('offline'))
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(memberships).toHaveBeenCalledTimes(2))
    expect(result.current.canManage(project)).toBe(false)
  })
})
