import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { projectVisibleToCaller } from '../project-access'
import { zql } from '../zql'

/** Cursor for the project page's virtualized thread list. */
export const projectThreadsCursor = z.object({
  pinned: z.boolean(),
  updatedAt: z.number(),
  threadId: z.string(),
})

const projectByIdArgs = z.object({
  projectId: z.string().trim().min(1),
})

const projectThreadsPageArgs = z.object({
  projectId: z.string().trim().min(1),
  limit: z.number().int().positive(),
  start: projectThreadsCursor.nullable().optional(),
  dir: z.enum(['forward', 'backward']),
  inclusive: z.boolean().optional(),
})

const projectAttachmentsArgs = z.object({
  projectId: z.string().trim().min(1),
})

export const projectQueryDefinitions = {
  projects: {
    list: defineQuery(z.object({}).optional(), ({ ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.project
        .where(
          projectVisibleToCaller({
            userID: ctx.userID,
            organizationId: orgId,
            isAnonymous: ctx.isAnonymous,
          }),
        )
        .where('deletedAt', 'IS', null)
        .orderBy('pinned', 'desc')
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
    }),

    byId: defineQuery(projectByIdArgs, ({ args, ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.project
        .where('id', args.projectId)
        .where(
          projectVisibleToCaller({
            userID: ctx.userID,
            organizationId: orgId,
            isAnonymous: ctx.isAnonymous,
          }),
        )
        .where('deletedAt', 'IS', null)
        .one()
    }),

    threadsPage: defineQuery(projectThreadsPageArgs, ({ args, ctx }) => {
      const orderDirection = args.dir === 'forward' ? 'desc' : 'asc'
      const orgId = ctx.organizationId?.trim()
      let q = zql.thread
        .where('userId', ctx.userID)
        .where('visibility', 'visible')
        .where('projectId', args.projectId)
        .whereExists('project', (project) =>
          project
            .where('id', args.projectId)
            .where('deletedAt', 'IS', null)
            .where(
              projectVisibleToCaller({
                userID: ctx.userID,
                isAnonymous: ctx.isAnonymous,
                organizationId: orgId,
              }),
            ),
        )
        .orderBy('pinned', orderDirection)
        .orderBy('updatedAt', orderDirection)
        .orderBy('threadId', orderDirection)
        .limit(args.limit)

      if (args.start) {
        q = q.start(args.start, { inclusive: args.inclusive ?? false })
      }

      return q
    }),

    /** Bounded recent activity, deliberately independent of sidebar pin order. */
    recentThreads: defineQuery(
      projectByIdArgs.extend({
        limit: z.number().int().positive(),
        search: z.string().trim().max(200).optional(),
      }),
      ({ args, ctx }) => {
        let query = zql.thread
          .where('userId', ctx.userID)
          .where('visibility', 'visible')
          .where('projectId', args.projectId)
          .whereExists('project', (project) =>
            project.where(projectVisibleToCaller(ctx)),
          )
          .orderBy('updatedAt', 'desc')
          .orderBy('threadId', 'desc')
          .limit(args.limit)
        // Filter upstream before applying the page limit, including older threads.
        if (args.search)
          query = query.where('title', 'ILIKE', `%${args.search}%`)
        return query
      },
    ),

    // Full attachment rows include bearer URLs and storage keys. Only owners sync them.
    attachments: defineQuery(projectAttachmentsArgs, ({ args, ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.attachment
        .where('projectId', args.projectId)
        .where('status', 'uploaded')
        .where('orgKnowledgeKind', 'IS', null)
        .whereExists('project', (project) =>
          project
            .where('id', args.projectId)
            .where('userId', ctx.userID)
            .where('deletedAt', 'IS', null)
            .where(
              projectVisibleToCaller({
                userID: ctx.userID,
                isAnonymous: ctx.isAnonymous,
                organizationId: orgId,
              }),
            ),
        )
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
    }),
  },
}
