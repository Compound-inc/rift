import { createFileRoute } from '@tanstack/react-router'
import { addContextToQuery } from '@rocicorp/zero/bindings'
import type { QueryOrQueryRequest, ReadonlyJSONValue } from '@rocicorp/zero'
import { mustGetQuery } from '@rocicorp/zero'
import { handleQueryRequest } from '@rocicorp/zero/server'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { schema } from '@/integrations/zero/schema'
import type { Schema } from '@/integrations/zero/schema'
import { queries } from '@/integrations/zero/queries'
import type { ZeroContext } from '@/integrations/zero/schema'

/**
 * Zero query endpoint.
 */
export const Route = createFileRoute('/api/zero/query')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getAuth()
        const { user } = auth
        if (!user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const organizationId =
          'organizationId' in auth && typeof auth.organizationId === 'string'
            ? auth.organizationId
            : undefined
        const context: ZeroContext = {
          userID: user.id,
          orgWorkosId: organizationId?.trim() || undefined,
        }
        const transformQuery = (name: string, args: unknown) => {
          const query = mustGetQuery(queries, name)(args as ReadonlyJSONValue | undefined) as QueryOrQueryRequest<
            keyof Schema['tables'] & string,
            ReadonlyJSONValue | undefined,
            ReadonlyJSONValue | undefined,
            Schema,
            unknown,
            ZeroContext
          >
          return addContextToQuery(query, context)
        }
        const result = await handleQueryRequest(
          transformQuery,
          schema,
          request,
          'error',
        )
        const status = result[0] === 'transformFailed' ? 400 : 200
        return new Response(JSON.stringify(result), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
