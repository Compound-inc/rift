import { createFileRoute } from '@tanstack/react-router'
import { PushProcessor } from '@rocicorp/zero/server'
import { zeroNodePg } from '@rocicorp/zero/server/adapters/pg'
import { Effect, Schema } from 'effect'
import { schema } from '@/integrations/zero/schema'
import { mutators } from '@/integrations/zero/mutators'
import type { ZeroContext } from '@/integrations/zero/schema'
import { emitWideErrorEvent } from '@/lib/chat-backend/observability/wide-event'
import { ChatErrorCode } from '@/lib/chat-contracts/error-codes'
import { getZeroUpstreamPool } from '@/lib/server-effect/infra/zero-upstream-pool'
import { requireUserAuth } from '@/lib/server-effect/http/server-auth'
import { ServerRuntime } from '@/lib/server-effect'

/**
 * Zero mutate endpoint. zero-cache calls this to run mutators against Postgres.
 * Requires cookie auth: set ZERO_MUTATE_FORWARD_COOKIES=true on zero-cache so
 * the session cookie is forwarded; we derive userID from server auth context,
 * not from forwarded headers.
 */
const pool = getZeroUpstreamPool()
const dbProvider = pool ? zeroNodePg(schema, pool) : null

class ZeroMutateUnauthorizedError extends Schema.TaggedErrorClass<ZeroMutateUnauthorizedError>()(
  'ZeroMutateUnauthorizedError',
  {
    message: Schema.String,
  },
) {}

class ZeroMutateProcessingError extends Schema.TaggedErrorClass<ZeroMutateProcessingError>()(
  'ZeroMutateProcessingError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

function containsBranchVersionConflict(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes('branch_version_conflict')
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsBranchVersionConflict(entry))
  }
  if (!value || typeof value !== 'object') {
    return false
  }
  return Object.values(value).some((entry) =>
    containsBranchVersionConflict(entry),
  )
}

export const Route = createFileRoute('/api/zero/mutate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!dbProvider) {
          return new Response(
            JSON.stringify({
              kind: 'PushFailed',
              message: 'ZERO_UPSTREAM_DB not configured',
              mutationIDs: [],
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const program = Effect.gen(function* () {
          const authContext = yield* requireUserAuth({
            headers: request.headers,
            onUnauthorized: () =>
              new ZeroMutateUnauthorizedError({ message: 'Unauthorized' }),
          })

          const context: ZeroContext = {
            userID: authContext.userId,
            organizationId: authContext.organizationId,
            isAnonymous: authContext.isAnonymous,
          }
          const requestId =
            request.headers.get('x-request-id') ?? crypto.randomUUID()
          const processor = new PushProcessor(dbProvider, context, 'error')
          const result = yield* Effect.tryPromise({
            try: () => processor.process(mutators, request),
            catch: (error) =>
              new ZeroMutateProcessingError({
                message: 'Zero mutate processing failed',
                cause: String(error),
              }),
          })

          if (containsBranchVersionConflict(result)) {
            yield* Effect.annotateLogs(
              Effect.logWarning('zero_mutate_branch_version_conflict'),
              {
                route: '/api/zero/mutate',
                request_id: requestId,
                user_id: authContext.userId,
              },
            )
            yield* emitWideErrorEvent({
              eventName: 'chat.branch.version.conflict',
              route: '/api/zero/mutate',
              requestId,
              userId: authContext.userId,
              errorCode: ChatErrorCode.BranchVersionConflict,
              errorTag: 'BranchVersionConflictError',
              message: 'branch_version_conflict',
              retryable: true,
              cause: 'zero_mutator_threads.selectBranchChild',
            })
          }

          const failed =
            'kind' in result && (result as { kind: string }).kind === 'PushFailed'
          const reason =
            failed && 'reason' in result
              ? (result as { reason: string }).reason
              : undefined
          const status = failed
            ? reason === 'Parse' || reason === 'UnsupportedPushVersion'
              ? 400
              : 500
            : 200

          return new Response(JSON.stringify(result), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        })

        try {
          return await ServerRuntime.run(program)
        } catch (error) {
          if (error instanceof ZeroMutateUnauthorizedError) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          if (error instanceof ZeroMutateProcessingError) {
            return new Response(
              JSON.stringify({
                kind: 'PushFailed',
                message: error.message,
                mutationIDs: [],
              }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            )
          }
          throw error
        }
      },
    },
  },
})
