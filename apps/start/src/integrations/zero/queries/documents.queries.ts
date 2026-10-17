import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { zql } from '../zql'

const scope = z.object({ threadId: z.string() })
/** Server-transformed queries are the permission boundary in Zero v1. */
export const documentQueryDefinitions = {
  documents: {
    byThread: defineQuery(scope, ({ args, ctx }) =>
      zql.document
        .where('threadId', args.threadId)
        .where('userId', ctx.userID)
        .where(
          'organizationId',
          ctx.organizationId ? '=' : 'IS',
          ctx.organizationId ?? null,
        )
        .where('deletedAt', 'IS', null)
        .whereExists('thread', (thread) =>
          thread.where('userId', ctx.userID)
            .where('ownerOrgId', ctx.organizationId ? '=' : 'IS', ctx.organizationId ?? null)
            .where(({ or, cmp, exists }) =>
            or(
              cmp('projectId', 'IS', null),
              exists('project', (project) =>
                project.where('deletedAt', 'IS', null),
              ),
            ),
          ),
        )
        .orderBy('createdAt', 'asc'),
    ),
    version: defineQuery(
      scope.extend({
        documentId: z.string(),
        version: z.number().int().positive(),
      }),
      ({ args, ctx }) =>
        zql.documentVersion
          .where('documentId', args.documentId)
          .where('version', args.version)
          .whereExists('document', (document) =>
            document
              .where('threadId', args.threadId)
              .where('userId', ctx.userID)
              .where('deletedAt', 'IS', null)
              .where(
                'organizationId',
                ctx.organizationId ? '=' : 'IS',
                ctx.organizationId ?? null,
              )
              .whereExists('thread', (thread) =>
                thread
                  .where('userId', ctx.userID)
                  .where('ownerOrgId', ctx.organizationId ? '=' : 'IS', ctx.organizationId ?? null)
                  .where(({ or, cmp, exists }) =>
                    or(
                      cmp('projectId', 'IS', null),
                      exists('project', (project) =>
                        project.where('deletedAt', 'IS', null),
                      ),
                    ),
                  ),
              ),
          )
          .one(),
    ),
  },
}
