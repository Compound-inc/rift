// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { m } from '@/paraglide/messages.js'
import { MemoryPolicyForm } from './memory-policy-form'

const { auth, manageMemory } = vi.hoisted(() => ({
  auth: { activeOrganizationId: 'org-1' as string | null },
  manageMemory: vi.fn(),
}))
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: vi.fn() }),
  useQuery: () => [undefined, { type: 'complete' }],
}))
vi.mock('@/integrations/zero', () => ({
  queries: { orgPolicy: { current: vi.fn() } },
  mutators: { orgPolicy: { setMemoryEnabled: vi.fn() } },
}))
vi.mock('@/lib/frontend/auth/use-auth', () => ({ useAppAuth: () => auth }))
vi.mock(
  '@/lib/frontend/settings/personalization/personalization.functions',
  () => ({
    managePersonalizationMemory: manageMemory,
  }),
)
beforeEach(() => {
  auth.activeOrganizationId = 'org-1'
  manageMemory.mockReset().mockResolvedValue({ configured: false })
})
afterEach(cleanup)

it('includes the displayed organization in status requests, including after a workspace switch', async () => {
  const view = render(<MemoryPolicyForm />)
  await waitFor(() =>
    expect(manageMemory).toHaveBeenLastCalledWith({
      data: { action: 'status', organizationId: 'org-1' },
    }),
  )
  auth.activeOrganizationId = 'org-2'
  view.rerender(<MemoryPolicyForm />)
  await waitFor(() =>
    expect(manageMemory).toHaveBeenLastCalledWith({
      data: { action: 'status', organizationId: 'org-2' },
    }),
  )
})

it('waits for the active workspace and clears an earlier load error once status loads', async () => {
  auth.activeOrganizationId = null
  const view = render(<MemoryPolicyForm />)
  expect(manageMemory).not.toHaveBeenCalled()

  manageMemory.mockRejectedValueOnce(new Error('Workspace changed'))
  auth.activeOrganizationId = 'org-1'
  view.rerender(<MemoryPolicyForm />)
  await screen.findByText(m.personalization_load_error())

  auth.activeOrganizationId = 'org-2'
  view.rerender(<MemoryPolicyForm />)
  await waitFor(() =>
    expect(screen.queryByText(m.personalization_load_error())).toBeNull(),
  )
})
