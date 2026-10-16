// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { organizationDetailFixture } from './singularity.test-fixtures'
import { useSingularityOrgDetailPageLogic } from './singularity-org-detail-page.logic'

const mocks = vi.hoisted(() => ({
  invite: vi.fn(),
  remove: vi.fn(),
  role: vi.fn(),
  cancel: vi.fn(),
  plan: vi.fn(),
  reset: vi.fn(),
  invalidate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}))
vi.mock('../frontend/singularity.functions', () => ({
  inviteSingularityOrganizationMember: mocks.invite,
  removeSingularityOrganizationMember: mocks.remove,
  updateSingularityOrganizationMemberRole: mocks.role,
  cancelSingularityInvitation: mocks.cancel,
  setSingularityOrganizationPlan: mocks.plan,
  resetSingularityOrganizationUsage: mocks.reset,
}))
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('Singularity management actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.invalidate.mockResolvedValue(undefined)
  })
  afterEach(cleanup)
  it('holds pending through the mutation and refresh and prevents concurrent actions', async () => {
    const mutation = deferred()
    const refresh = deferred()
    mocks.invite.mockReturnValue(mutation.promise)
    mocks.invalidate.mockReturnValue(refresh.promise)
    const { result } = renderHook(() =>
      useSingularityOrgDetailPageLogic(organizationDetailFixture()),
    )
    let pending!: Promise<boolean>
    act(() => {
      pending = result.current.handleInvite(' New@Example.com ', 'member')
    })
    expect(result.current.isPending).toBe(true)
    await act(async () => {
      expect(await result.current.handleRoleChange('member-1', 'admin')).toBe(
        false,
      )
    })
    expect(mocks.role).not.toHaveBeenCalled()
    await act(async () => {
      mutation.resolve()
      await mutation.promise
    })
    expect(result.current.isPending).toBe(true)
    await act(async () => {
      refresh.resolve()
      expect(await pending).toBe(true)
    })
    expect(result.current.isPending).toBe(false)
    expect(mocks.invite).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        email: 'new@example.com',
        role: 'member',
      },
    })
  })
  it('reports mutation failure without indicating success or refreshing', async () => {
    mocks.invite.mockRejectedValue(new Error('Delivery unavailable'))
    const { result } = renderHook(() =>
      useSingularityOrgDetailPageLogic(organizationDetailFixture()),
    )
    await act(async () => {
      expect(
        await result.current.handleInvite('new@example.com', 'member'),
      ).toBe(false)
    })
    expect(mocks.error).toHaveBeenCalledWith('Delivery unavailable')
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.invalidate).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })
  it('rejects invalid and duplicate invitations before contacting the server', async () => {
    const { result } = renderHook(() =>
      useSingularityOrgDetailPageLogic(organizationDetailFixture()),
    )
    await act(async () => {
      expect(await result.current.handleInvite('bad email', 'member')).toBe(
        false,
      )
      expect(
        await result.current.handleInvite(' OWNER@EXAMPLE.COM ', 'member'),
      ).toBe(false)
      expect(
        await result.current.handleInvite('invited@example.com', 'admin'),
      ).toBe(false)
    })
    expect(mocks.invite).not.toHaveBeenCalled()
  })
  it('protects the final owner and skips unchanged roles', async () => {
    const { result } = renderHook(() =>
      useSingularityOrgDetailPageLogic(organizationDetailFixture()),
    )
    await act(async () => {
      expect(await result.current.handleRemoveMember('owner-1')).toBe(false)
      expect(await result.current.handleRoleChange('owner-1', 'member')).toBe(
        false,
      )
      expect(await result.current.handleRoleChange('member-1', 'member')).toBe(
        false,
      )
    })
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.role).not.toHaveBeenCalled()
  })

  it('counts pending invitations when checking remaining seat capacity', async () => {
    const { result } = renderHook(() =>
      useSingularityOrgDetailPageLogic(
        organizationDetailFixture({ seatCount: 3 }),
      ),
    )
    await act(async () => {
      expect(
        await result.current.handleInvite('new@example.com', 'member'),
      ).toBe(false)
    })
    expect(mocks.invite).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Increase seat capacity'),
    )
  })
  it('reports a saved mutation separately from a failed refresh', async () => {
    mocks.invalidate.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() =>
      useSingularityOrgDetailPageLogic(organizationDetailFixture()),
    )
    await act(async () => {
      expect(await result.current.handleResetUsage('current_cycle_usage')).toBe(
        true,
      )
    })
    expect(mocks.reset).toHaveBeenCalledTimes(1)
    expect(mocks.success).toHaveBeenCalledWith('Current cycle usage reset.')
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Change saved'),
    )
    expect(result.current.needsRefresh).toBe(true)
    await act(async () => {
      expect(await result.current.handleResetUsage('fresh_cycle')).toBe(false)
    })
    expect(mocks.reset).toHaveBeenCalledTimes(1)
    mocks.invalidate.mockResolvedValue(undefined)
    await act(async () => {
      await result.current.handleRefresh()
    })
    expect(result.current.needsRefresh).toBe(false)
  })
})
