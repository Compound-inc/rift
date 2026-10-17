// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectVisibilityControl } from './project-visibility-control'

const { mutate, update, access, auth } = vi.hoisted(() => ({
  mutate: vi.fn(),
  update: vi.fn((args: unknown) => args),
  access: { canManage: vi.fn(() => true), isOrphan: vi.fn(() => false) },
  auth: { activeOrganizationId: 'org' },
}))
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate }) }))
vi.mock('@/integrations/zero', () => ({ mutators: { projects: { update } } }))
vi.mock('@/lib/frontend/auth/use-auth', () => ({ useAppAuth: () => auth }))
vi.mock('@/lib/frontend/projects/use-project-management-access', () => ({
  useProjectManagementAccess: () => access,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const project = { id: 'p', userId: 'owner', organizationId: 'org', visibility: 'private' as const }

beforeEach(() => {
  vi.clearAllMocks()
  auth.activeOrganizationId = 'org'
  mutate.mockReturnValue({ server: Promise.resolve({ type: 'success' }) })
  // Base UI measures the popup when keyboard navigation scrolls an item.
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('project visibility picker', () => {
  it.each([false, true])('supports keyboard sharing in compact=%s', async (compact) => {
    render(<ProjectVisibilityControl project={project} compact={compact} />)
    const trigger = screen.getByRole('combobox')
    expect(trigger.textContent).toContain('Private')
    fireEvent.focus(trigger)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const workspace = await screen.findByRole('option', { name: 'Workspace' })
    fireEvent.keyDown(workspace, { key: 'End' })
    fireEvent.keyDown(workspace, { key: 'Enter' })
    await waitFor(() => expect(update).toHaveBeenCalledWith({
      projectId: 'p', patch: { visibility: 'org' },
    }))
  })

  it('disables workspace sharing outside the project organization', async () => {
    auth.activeOrganizationId = 'other-org'
    render(<ProjectVisibilityControl project={project} />)
    fireEvent.click(screen.getByRole('combobox'))
    const workspace = await screen.findByRole('option', { name: 'Workspace' })
    expect(workspace.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(workspace)
    expect(mutate).not.toHaveBeenCalled()
  })
})
