import { describe, expect, it, vi } from 'vitest'
import type { Effect } from 'effect'
import { forkShare, manageShare, readShare } from './thread-sharing.server'

vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }))
vi.mock('@/lib/backend/server-effect/http/server-auth', async () => {
  const { Effect } = await import('effect')
  return { getServerAuthContext: () => Effect.succeed({ userId: 'viewer', isAnonymous: false }) }
})
vi.mock('@/lib/backend/thread-sharing/runtime/thread-sharing-runtime', async () => {
  const { Effect } = await import('effect')
  const { ThreadSharingService } = await import('@/lib/backend/thread-sharing/services/thread-sharing.service')
  const { SharePersistenceError } = await import('@/lib/backend/thread-sharing/domain/errors')
  const fail = () => Effect.fail(new SharePersistenceError({
    message: 'Sharing unavailable',
    cause: 'private database details',
  }))
  return {
    ThreadSharingRuntime: {
      run: (program: Effect.Effect<unknown, unknown, InstanceType<typeof ThreadSharingService>>) =>
        Effect.runPromise(program.pipe(Effect.provideService(ThreadSharingService, {
          read: fail,
          manage: fail,
          fork: fail,
        }))),
    },
  }
})

describe('sharing server error boundary', () => {
  it.each([
    ['read', () => readShare('share')],
    ['manage', () => manageShare({ threadId: 'thread', action: 'activate' })],
    ['fork', () => forkShare('share')],
  ] as const)('removes persistence diagnostics from %s errors', async (_name, run) => {
    const error = await run().catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(Error)
    expect(error).toHaveProperty('message', 'Sharing unavailable')
    expect(error).not.toHaveProperty('cause')
    expect(error).not.toHaveProperty('_tag')
  })
})
