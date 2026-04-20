import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { zql } from '../zql'

const projectIdArgs = z.object({
  projectId: z.string().trim().min(1),
})

const fileByPathArgs = projectIdArgs.extend({
  path: z.string().trim().min(1),
})

const chatIdArgs = z.object({
  chatId: z.string().trim().min(1),
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
    chatsByProject: defineQuery(projectIdArgs, ({ args, ctx }) =>
      zql.writingProjectChat
        .whereExists('project', (project) =>
          applyProjectScope(project.where('id', args.projectId), ctx),
        )
        .where('projectId', args.projectId)
        .orderBy('updatedAt', 'desc'),
    ),
    sidebarProjects: defineQuery(writingSidebarProjectsArgs, ({ args, ctx }) =>
      applyProjectScope(zql.writingProject, ctx)
        .orderBy('updatedAt', 'desc')
        .limit(args.limit)
        .related('chats', (chats) =>
          chats
            .where('status', 'active')
            .orderBy('updatedAt', 'desc'),
        )
    ),
    messagesByChat: defineQuery(chatIdArgs, ({ args, ctx }) =>
      zql.writingChatMessage
        .whereExists('chat', (chat) =>
          chat.where('id', args.chatId).whereExists('project', (project) =>
            applyProjectScope(project, ctx),
          ),
        )
        .where('chatId', args.chatId)
        .orderBy('createdAt', 'asc'),
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
