import {
  createBuilder,
  defineQueriesWithType,
  defineQuery,
} from '@rocicorp/zero'
import { z } from 'zod'
import { schema, type Schema } from './schema'

const zql = createBuilder(schema)

export { type ZeroContext } from './schema'

export const queries = defineQueriesWithType<Schema>()({
  threads: {
    /** Threads for the current user (ctx.userID). Enforced on server. */
    byUser: defineQuery(({ ctx }) =>
      zql.thread.where('userId', ctx.userID).orderBy('updatedAt', 'desc'),
    ),
  },
  messages: {
    /** Messages in a thread, always scoped to the authenticated user context. */
    byThread: defineQuery(
      z.object({ threadId: z.string() }),
      ({ args, ctx }) =>
        zql.message
          .where('threadId', args.threadId)
          .where('userId', ctx.userID)
          .orderBy('created_at', 'asc'),
    ),
  },
})
