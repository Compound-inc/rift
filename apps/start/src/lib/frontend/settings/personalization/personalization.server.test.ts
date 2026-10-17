import { Effect } from 'effect'
import { expect, it, vi } from 'vitest'
import { runMemoryAction } from './personalization.server'

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => new Headers(),
}))
vi.mock('@/lib/backend/server-effect/http/server-auth', () => ({
  requireNonAnonymousUserAuth: () =>
    Effect.succeed({ userId: 'user-1', organizationId: 'org-1' }),
}))
vi.mock('@/lib/backend/chat/runtime/chat-runtime', () => ({
  // Workspace rejection must happen before the boundary program asks for any
  // personalization or memory service, so no infrastructure is provided here.
  ChatRuntime: { run: Effect.runPromise },
}))
vi.mock('@/lib/backend/chat/runtime/memory-purge-runtime', () => ({
  kickMemoryPurge: vi.fn(),
}))

it.each([
  { action: 'status' },
  { action: 'list', page: 1 },
  { action: 'delete', id: 'memory-1' },
  { action: 'delete-all' },
] as const)(
  'rejects a $action request missing the displayed organization id',
  async (data) => {
    await expect(runMemoryAction(data)).rejects.toMatchObject({
      _tag: 'MemoryError',
      operation: 'workspace',
      message: 'Workspace changed. Reload this page and try again.',
    })
  },
)
