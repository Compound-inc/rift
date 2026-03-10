import { createFileRoute } from '@tanstack/react-router'
import { addContextToQuery } from '@rocicorp/zero/bindings'
import type { QueryOrQueryRequest, ReadonlyJSONValue } from '@rocicorp/zero'
import { mustGetQuery } from '@rocicorp/zero'
import { handleQueryRequest } from '@rocicorp/zero/server'
import { Effect, Schema } from 'effect'
import { schema } from '@/integrations/zero/schema'
import type { Schema as ZeroSchema, ZeroContext } from '@/integrations/zero/schema'
import { queries } from '@/integrations/zero/queries'
import { requireUserAuth } from '@/lib/server-effect/http/server-auth'
import { ServerRuntime } from '@/lib/server-effect'

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
          const authContext = yield* requireUserAuth({
            headers: request.headers,
            onUnauthorized: () =>
              new ZeroQueryUnauthorizedError({ message: 'Unauthorized' }),
          })

          const context: ZeroContext = {
            userID: authContext.userId,
            organizationId: authContext.organizationId,
            isAnonymous: authContext.isAnonymous,
          }
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
