import { createFileRoute } from '@tanstack/react-router'
import { addContextToQuery } from '@rocicorp/zero/bindings'
import type { QueryOrQueryRequest, ReadonlyJSONValue } from '@rocicorp/zero'
import { mustGetQuery } from '@rocicorp/zero'
import { handleQueryRequest } from '@rocicorp/zero/server'
import { Effect, Schema } from 'effect'
import { schema } from '@/integrations/zero/schema'
import type { Schema as ZeroSchema, ZeroContext } from '@/integrations/zero/schema'
import { queries } from '@/integrations/zero/queries'
import { requireUserAuth } from '@/lib/server-effect/http/server-auth.server'
import { ServerRuntime } from '@/lib/server-effect'

/**
 * Temporary non-production auth bypass for Zero query/mutate traffic.
 * Enable only in isolated environments while debugging deployment/auth issues.
 */
const zeroAuthBypassEnabled = process.env.ZERO_AUTH_BYPASS === 'true'
const zeroAuthBypassUserId = process.env.ZERO_AUTH_BYPASS_USER_ID ?? 'dev-user'
const zeroAuthBypassOrgId =
  process.env.ZERO_AUTH_BYPASS_ORG_ID?.trim() || undefined

class ZeroQueryUnauthorizedError extends Schema.TaggedErrorClass<ZeroQueryUnauthorizedError>()(
  'ZeroQueryUnauthorizedError',
  {
    message: Schema.String,
  },
) {}

class ZeroQueryProcessingError extends Schema.TaggedErrorClass<ZeroQueryProcessingError>()(
  'ZeroQueryProcessingError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

/**
 * Zero query endpoint.
 */
export const Route = createFileRoute('/api/zero/query')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const program = Effect.gen(function* () {
          const context: ZeroContext = zeroAuthBypassEnabled
            ? {
                userID: zeroAuthBypassUserId,
                orgWorkosId: zeroAuthBypassOrgId,
              }
            : yield* requireUserAuth({
                onUnauthorized: () =>
                  new ZeroQueryUnauthorizedError({ message: 'Unauthorized' }),
              }).pipe(
                Effect.map((authContext) => ({
                  userID: authContext.userId,
                  orgWorkosId: authContext.orgWorkosId,
                })),
              )

          const transformQuery = (name: string, args: unknown) => {
            const query = mustGetQuery(queries, name)(
              args as ReadonlyJSONValue | undefined,
            ) as QueryOrQueryRequest<
              keyof ZeroSchema['tables'] & string,
              ReadonlyJSONValue | undefined,
              ReadonlyJSONValue | undefined,
              ZeroSchema,
              unknown,
              ZeroContext
            >
            return addContextToQuery(query, context)
          }

          const result = yield* Effect.tryPromise({
            try: () => handleQueryRequest(transformQuery, schema, request, 'error'),
            catch: (error) =>
              new ZeroQueryProcessingError({
                message: 'Zero query processing failed',
                cause: String(error),
              }),
          })

          const status = result[0] === 'transformFailed' ? 400 : 200
          return new Response(JSON.stringify(result), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        })

        try {
          return await ServerRuntime.run(program)
        } catch (error) {
          if (error instanceof ZeroQueryUnauthorizedError) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          if (error instanceof ZeroQueryProcessingError) {
            return new Response(
              JSON.stringify([
                'transformFailed',
                {
                  kind: 'internal',
                  message: error.message,
                },
              ]),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            )
          }
          throw error
        }
      },
    },
  },
})
