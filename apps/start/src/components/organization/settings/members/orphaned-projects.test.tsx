// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrphanedProjects } from './orphaned-projects'

const { auth, load, mutate, resolveOrphan } = vi.hoisted(() => ({
  auth: {
    user: { id: 'admin' },
    isAnonymous: false,
    activeOrganizationId: 'org',
    activeOrganizationRole: 'admin',
  },
  load: vi.fn(),
  mutate: vi.fn(),
  resolveOrphan: vi.fn((args: unknown) => args),
}))
vi.mock('@/lib/frontend/auth/use-auth', () => ({ useAppAuth: () => auth }))
vi.mock('@/lib/frontend/projects/project-owner.functions', () => ({
  getOrphanedProjects: load,
}))
vi.mock('@/integrations/zero', () => ({
  mutators: { projects: { resolveOrphan } },
}))
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('@rift/ui/dialog', () => ({
  FormDialog: (props: {
    open: boolean
    title: string
    description: string
    error?: string
    buttonText: string
    buttonDisabled: boolean
    handleSubmit: () => Promise<void>
  }) =>
    props.open ? (
      <section role="dialog" aria-label={props.title}>
        <p>{props.description}</p>
        {props.error ? <p role="alert">{props.error}</p> : null}
        <button
          disabled={props.buttonDisabled}
          onClick={() => void props.handleSubmit()}
        >
          {props.buttonText}
        </button>
      </section>
    ) : null,
}))

const orphan = {
  id: 'p',
  name: 'Departed owner project',
  formerOwnerName: 'Former owner',
  createdAt: 1000,
}
beforeEach(() => {
  vi.clearAllMocks()
  load.mockResolvedValue([orphan])
  auth.activeOrganizationId = 'org'
  auth.activeOrganizationRole = 'admin'
})
afterEach(cleanup)

describe('admin orphan remediation', () => {
  it.each(['private', 'delete'] as const)(
    'confirms %s and waits for both mutation phases',
    async (action) => {
      let finishServer!: (result: { type: string }) => void
      mutate.mockReturnValue({
        client: Promise.resolve({ type: 'success' }),
        server: new Promise((resolve) => {
          finishServer = resolve
        }),
      })
      render(<OrphanedProjects refreshKey={null} />)
      await screen.findByText(orphan.name)
      fireEvent.click(
        screen.getByRole('button', {
          name: action === 'private' ? 'Make private' : 'Delete project',
        }),
      )
      expect(mutate).not.toHaveBeenCalled()
      const dialog = screen.getByRole('dialog')
      const confirm = within(dialog).getByRole('button')
      fireEvent.click(confirm)
      await waitFor(() =>
        expect(resolveOrphan).toHaveBeenCalledWith({ projectId: 'p', action }),
      )
      expect(screen.queryByRole('dialog')).toBeTruthy()
      expect(confirm.hasAttribute('disabled')).toBe(true)
      load.mockResolvedValue([])
      finishServer({ type: 'success' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await screen.findByText('No orphaned projects.')
    },
  )

  it.each(['client', 'server'] as const)(
    'keeps confirmation open on a %s error result',
    async (phase) => {
      mutate.mockReturnValue({
        client: Promise.resolve({
          type: phase === 'client' ? 'error' : 'success',
        }),
        server: Promise.resolve({
          type: phase === 'server' ? 'error' : 'success',
        }),
      })
      render(<OrphanedProjects refreshKey={null} />)
      await screen.findByText(orphan.name)
      fireEvent.click(screen.getByRole('button', { name: 'Make private' }))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button'))
      await screen.findByRole('alert')
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByText(orphan.name)).toBeTruthy()
    },
  )

  it('hides the admin block from ordinary members', () => {
    auth.activeOrganizationRole = 'member'
    render(<OrphanedProjects refreshKey={null} />)
    expect(load).not.toHaveBeenCalled()
    expect(screen.queryByText('Orphaned projects')).toBeNull()
  })

  it('clears the old workspace list and confirmation on an org switch', async () => {
    const view = render(<OrphanedProjects refreshKey={null} />)
    await screen.findByText(orphan.name)
    fireEvent.click(screen.getByRole('button', { name: 'Make private' }))
    load.mockResolvedValue([])
    auth.activeOrganizationId = 'other-org'
    view.rerender(<OrphanedProjects refreshKey={null} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(orphan.name)).toBeNull()
    await screen.findByText('No orphaned projects.')
  })
})
