// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppAuth } from './use-auth'

const state = vi.hoisted(() => ({
  session: { data: null as unknown, isPending: false, refetch: vi.fn() },
  getRole: vi.fn(),
}))
vi.mock('./auth-client', () => ({
  authClient: {
    useSession: () => state.session,
    organization: { getActiveMemberRole: state.getRole },
  },
}))

function member(userId = 'member', organizationId = 'org') {
  return {
    user: { id: userId, isAnonymous: false },
    session: { id: 'session', activeOrganizationId: organizationId },
  }
}

function pendingRole() {
  let resolve!: (value: { data: { role: string }; error: null }) => void
  const promise = new Promise<{ data: { role: string }; error: null }>(
    (done) => {
      resolve = done
    },
  )
  return { promise, resolve }
}

describe('workspace role requests', () => {
  beforeEach(() => {
    state.getRole
      .mockReset()
      .mockResolvedValue({ data: { role: 'owner' }, error: null })
    state.session.isPending = false
  })
  afterEach(cleanup)

  it.each([
    null,
    { user: { id: 'guest', isAnonymous: true }, session: {} },
    {
      user: { id: 'guest', isAnonymous: true },
      session: { activeOrganizationId: 'stale-org' },
    },
    { user: { id: 'member', isAnonymous: false }, session: {} },
  ])(
    'does not request membership without a signed-in workspace: %j',
    (session) => {
      state.session.data = session
      const { result } = renderHook(useAppAuth)
      expect(state.getRole).not.toHaveBeenCalled()
      expect(result.current.activeOrganizationRole).toBeNull()
    },
  )

  it('shares a public, explicitly scoped request between auth consumers', async () => {
    state.session.data = member()
    const first = renderHook(useAppAuth)
    const second = renderHook(useAppAuth)
    await waitFor(() =>
      expect(first.result.current.activeOrganizationRole).toBe('owner'),
    )
    expect(second.result.current.activeOrganizationRole).toBe('owner')
    expect(state.getRole).toHaveBeenCalledOnce()
    const options = state.getRole.mock.calls[0][0]
    expect(options.query).toEqual({ organizationId: 'org' })
    first.unmount()
    expect(options.fetchOptions.signal.aborted).toBe(false)
    second.unmount()
    expect(options.fetchOptions.signal.aborted).toBe(true)
  })

  it('cancels on sign-out and ignores a late membership response', async () => {
    const pending = pendingRole()
    state.getRole.mockReturnValueOnce(pending.promise)
    state.session.data = member()
    const { result, rerender } = renderHook(useAppAuth)
    const signal = state.getRole.mock.calls[0][0].fetchOptions
      .signal as AbortSignal
    state.session.data = null
    rerender()
    expect(signal.aborted).toBe(true)
    await act(async () => {
      pending.resolve({ data: { role: 'owner' }, error: null })
    })
    expect(result.current.activeOrganizationRole).toBeNull()
    rerender()
    expect(state.getRole).toHaveBeenCalledOnce()
    state.session.data = member()
    rerender()
    await waitFor(() =>
      expect(result.current.activeOrganizationRole).toBe('owner'),
    )
    expect(state.getRole).toHaveBeenCalledTimes(2)
  })

  it.each([member('other-user'), member('member', 'other-org')])(
    'does not reuse permissions after identity changes: %j',
    async (next) => {
      state.session.data = member()
      const { result, rerender } = renderHook(useAppAuth)
      await waitFor(() =>
        expect(result.current.activeOrganizationRole).toBe('owner'),
      )
      const pending = pendingRole()
      state.getRole.mockReturnValueOnce(pending.promise)
      state.session.data = next
      rerender()
      expect(result.current.activeOrganizationRole).toBeNull()
      await act(async () => {
        pending.resolve({ data: { role: 'member' }, error: null })
      })
      expect(result.current.activeOrganizationRole).toBe('member')
    },
  )

  it('cancels and hides permissions while the session is pending', async () => {
    state.session.data = member()
    const { result, rerender } = renderHook(useAppAuth)
    await waitFor(() =>
      expect(result.current.activeOrganizationRole).toBe('owner'),
    )
    state.session.isPending = true
    rerender()
    expect(result.current.activeOrganizationRole).toBeNull()
    expect(state.getRole.mock.calls[0][0].fetchOptions.signal.aborted).toBe(
      true,
    )
  })
})
