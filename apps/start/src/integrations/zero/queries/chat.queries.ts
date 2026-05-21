import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { zql } from '../zql'

const orgScopedThreadByIdArgs = z.object({
  threadId: z.string(),
  organizationId: z.string().trim().min(1).optional(),
})

/**
 * Cursor used by the sidebar history list. It mirrors the compound ordering so
 * Zero can continue the query without materializing the entire thread set.
 */
export const threadHistoryCursor = z.object({
  pinned: z.boolean(),
  updatedAt: z.number(),
  threadId: z.string(),
})

const threadHistoryPageArgs = z.object({
  organizationId: z.string().trim().min(1).optional(),
  limit: z.number().int().positive(),
  start: threadHistoryCursor.nullable().optional(),
  dir: z.enum(['forward', 'backward']),
  inclusive: z.boolean().optional(),
})

/**
 * Chat query definitions are grouped here to keep thread/message read models
 * cohesive and avoid coupling to organization settings queries.
 */
export const chatQueryDefinitions = {
  threads: {
    historyPage: defineQuery(threadHistoryPageArgs, ({ args, ctx }) => {
      const orderDirection = args.dir === 'forward' ? 'desc' : 'asc'
      const organizationId = args.organizationId?.trim()
      let q = zql.thread
        .where('userId', ctx.userID)
        .where('visibility', 'visible')
        .where('projectId', 'IS', null)
        .orderBy('pinned', orderDirection)
        .orderBy('updatedAt', orderDirection)
        .orderBy('threadId', orderDirection)
        .limit(args.limit)

      if (organizationId) {
        q = q.where('ownerOrgId', organizationId)
      }

      if (args.start) {
        q = q.start(args.start, { inclusive: args.inclusive ?? false })
      }

      return q
    }),
    byId: defineQuery(orgScopedThreadByIdArgs, ({ args, ctx }) => {
      const organizationId = args.organizationId?.trim()
      let q = zql.thread
        .where('threadId', args.threadId)
        .where('userId', ctx.userID)
        .where(({ or, cmp, exists }) =>
          or(
            cmp('projectId', 'IS', null),
            exists('project', (project) =>
              project.where('deletedAt', 'IS', null),
            ),
          ),
        )
      if (organizationId) {
        q = q.where('ownerOrgId', organizationId)
      }

      return q.one()
    }),
  },
  messages: {
    /** Messages in a thread, always scoped to the authenticated user context. */
    byThread: defineQuery(z.object({ threadId: z.string() }), ({ args, ctx }) =>
      zql.message
        .where('threadId', args.threadId)
        .where('userId', ctx.userID)
        .orderBy('created_at', 'asc'),
    ),
  },
}
