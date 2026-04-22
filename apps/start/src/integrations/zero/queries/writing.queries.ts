import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { zql } from '../zql'

const projectIdArgs = z.object({
  projectId: z.string().trim().min(1),
})

const fileByPathArgs = projectIdArgs.extend({
  path: z.string().trim().min(1),
})

const conversationIdArgs = z.object({
  conversationId: z.string().trim().min(1),
})

const writingSidebarProjectsArgs = z.object({
  limit: z.number().int().positive(),
})

const changeSetIdArgs = z.object({
  changeSetId: z.string().trim().min(1),
})

function applyProjectScope<TQuery extends {
  where: (field: string, value: string) => TQuery
}>(query: TQuery, ctx: { userID: string; organizationId?: string }) {
  const scopedOrgId = ctx.organizationId?.trim()
  const scoped = query.where('ownerUserId', ctx.userID)

  return scopedOrgId
    ? scoped.where('ownerOrgId', scopedOrgId)
    : scoped.where('ownerOrgId', '')
}

export const writingQueryDefinitions = {
  writing: {
    projects: defineQuery(z.object({}), ({ ctx }) =>
      applyProjectScope(zql.writingProject, ctx)
        .orderBy('updatedAt', 'desc'),
    ),
    projectById: defineQuery(projectIdArgs, ({ args, ctx }) =>
      applyProjectScope(zql.writingProject.where('id', args.projectId), ctx).one(),
    ),
    entriesByProject: defineQuery(projectIdArgs, ({ args, ctx }) =>
      zql.writingEntry
        .whereExists('project', (project) =>
          applyProjectScope(project.where('id', args.projectId), ctx),
        )
        .where('projectId', args.projectId)
        .orderBy('path', 'asc'),
    ),
    fileByPath: defineQuery(fileByPathArgs, ({ args, ctx }) =>
      zql.writingEntry
        .whereExists('project', (project) =>
          applyProjectScope(project.where('id', args.projectId), ctx),
        )
        .where('projectId', args.projectId)
        .where('path', args.path)
        .related('blob')
        .one(),
    ),
    conversationsByProject: defineQuery(projectIdArgs, ({ args, ctx }) =>
      zql.agentConversation
        .whereExists('project', (project) =>
          applyProjectScope(project.where('id', args.projectId), ctx),
        )
        .where('product', 'writing')
        .where('scopeType', 'writing_project')
        .where('scopeId', args.projectId)
        .orderBy('updatedAt', 'desc'),
    ),
    sidebarProjects: defineQuery(writingSidebarProjectsArgs, ({ args, ctx }) =>
      applyProjectScope(zql.writingProject, ctx)
        .orderBy('updatedAt', 'desc')
        .limit(args.limit)
        .related('conversations', (conversations) =>
          conversations
            .where('product', 'writing')
            .where('scopeType', 'writing_project')
            .where('status', 'active')
            .orderBy('updatedAt', 'desc'),
        )
    ),
    messagesByConversation: defineQuery(conversationIdArgs, ({ args, ctx }) =>
      zql.agentMessage
        .whereExists('conversation', (conversation) =>
          conversation
            .where('id', args.conversationId)
            .where('product', 'writing')
            .where('scopeType', 'writing_project')
            .whereExists('project', (project) =>
            applyProjectScope(project, ctx),
            ),
        )
        .where('conversationId', args.conversationId)
        .orderBy('messageIndex', 'asc'),
    ),
    snapshotsByProject: defineQuery(projectIdArgs, ({ args, ctx }) =>
      zql.writingSnapshot
        .whereExists('project', (project) =>
          applyProjectScope(project.where('id', args.projectId), ctx),
        )
        .where('projectId', args.projectId)
        .orderBy('createdAt', 'desc'),
    ),
    changeSetsByProject: defineQuery(projectIdArgs, ({ args, ctx }) =>
      zql.writingChangeSet
        .whereExists('project', (project) =>
          applyProjectScope(project.where('id', args.projectId), ctx),
        )
        .where('projectId', args.projectId)
        .orderBy('createdAt', 'desc'),
    ),
    changesByChangeSet: defineQuery(changeSetIdArgs, ({ args, ctx }) =>
      zql.writingChange
        .whereExists('changeSet', (changeSet) =>
          changeSet.where('id', args.changeSetId).whereExists('project', (project) =>
            applyProjectScope(project, ctx),
          ),
        )
        .where('changeSetId', args.changeSetId)
        .orderBy('path', 'asc'),
    ),
    hunksByChangeSet: defineQuery(changeSetIdArgs, ({ args, ctx }) =>
      zql.writingChangeHunk
        .whereExists('change', (change) =>
          change.whereExists('changeSet', (changeSet) =>
            changeSet.where('id', args.changeSetId).whereExists('project', (project) =>
              applyProjectScope(project, ctx),
            ),
          ),
        )
        .orderBy('createdAt', 'asc'),
    ),
  },
}
