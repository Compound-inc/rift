import { Effect } from 'effect'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { ChatRuntime } from '@/lib/backend/chat/runtime/chat-runtime'
import { requireNonAnonymousUserAuth } from '@/lib/backend/server-effect/http/server-auth'
import { MemoryService } from '@/lib/backend/chat/services/personalization/memory.service'
import { PersonalizationService } from '@/lib/backend/chat/services/personalization/personalization.service'
import { MemoryLedgerService } from '@/lib/backend/chat/services/personalization/memory-ledger.service'
import { kickMemoryPurge } from '@/lib/backend/chat/runtime/memory-purge-runtime'
import { validateMemoryOrganization } from '@/lib/shared/personalization/policy'
import { MemoryError } from '@/lib/backend/chat/services/personalization/domain'

/** Deletion remains available when consent/org policy is off, including ZDR. */
export function runMemoryAction(
  data:
    | { action: 'status'; organizationId?: string }
    | { action: 'list'; page: number; organizationId?: string }
    | { action: 'delete'; id: string; organizationId?: string }
    | { action: 'delete-all'; organizationId?: string },
) {
  return ChatRuntime.run(
    Effect.gen(function* () {
      const auth = yield* requireNonAnonymousUserAuth({
        headers: getRequestHeaders(),
        onUnauthorized: () =>
          new MemoryError({ operation: 'auth', message: 'Unauthorized' }),
      })
      if (!validateMemoryOrganization(data.organizationId, auth.organizationId))
        return yield* Effect.fail(
          new MemoryError({
            operation: 'workspace',
            message: 'Workspace changed. Reload this page and try again.',
          }),
        )
      const preferences = yield* PersonalizationService
      const memory = yield* MemoryService
      const current = yield* preferences.load(auth.userId, auth.organizationId)
      if (data.action === 'status')
        return { configured: memory.configured, policy: current.policy }
      if (data.action === 'delete-all' && auth.organizationId) {
        yield* preferences.reset(auth.userId, auth.organizationId)
        kickMemoryPurge()
        return { success: true }
      }
      if (!current.scope || !memory.configured)
        return yield* Effect.fail(
          new MemoryError({
            operation: data.action,
            message: 'Memory is unavailable',
          }),
        )
      if (data.action === 'list')
        return { page: yield* memory.list(current.scope, data.page) }
      if (data.action === 'delete') {
        const source = yield* memory.sourceDocument(current.scope, data.id)
        if (source) {
          yield* (yield* MemoryLedgerService).queueDocument(
            current.scope,
            source,
          )
          kickMemoryPurge()
        }
        yield* memory.deleteOne(current.scope, data.id)
      }
      return { success: true }
    }),
  )
}
