// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppAuth } from './use-auth'
import { authClient } from './auth-client'

const state = vi.hoisted(() => ({
  session: {
    data: {
      user: { id: 'member', isAnonymous: false },
      session: { id: 'session', activeOrganizationId: 'org' },
    } as unknown,
    isPending: false,
  },
  fetch: vi.fn(async () => Response.json({ role: 'owner' })),
}))

vi.mock('./auth-client', async () => {
  const { createAuthClient } = await import('better-auth/react')
  const { organizationClient } = await import('better-auth/client/plugins')
  const client = createAuthClient({
    baseURL: 'http://localhost:3000',
    plugins: [organizationClient()],
    fetchOptions: { customFetchImpl: state.fetch },
  })
  return {
    authClient: {
      organization: client.organization,
      $store: client.$store,
      useSession: () => state.session,
    },
  }
})

afterEach(cleanup)

it('does not leave Better Auth role networking active after sign-out', async () => {
  const { result, rerender } = renderHook(useAppAuth)
  await waitFor(() =>
    expect(result.current.activeOrganizationRole).toBe('owner'),
  )
  expect(state.fetch).toHaveBeenCalledOnce()
  state.session.data = null
  rerender()
  await act(async () => {
    authClient.$store.notify('$activeOrgSignal')
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
  expect(state.fetch).toHaveBeenCalledOnce()
  expect(result.current.activeOrganizationRole).toBeNull()
})
