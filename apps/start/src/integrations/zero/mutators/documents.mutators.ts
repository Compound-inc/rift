import { defineMutator } from '@rocicorp/zero'
import { z } from 'zod'
import {
  ownsDocument,
  updateDocumentSchema,
} from '@/lib/shared/documents/contracts'
import { zql } from '../zql'

/** User saves and restores append versions. An expected version prevents lost edits. */
export const documentMutatorDefinitions = {
  documents: {
    save: defineMutator(
      updateDocumentSchema.omit({ baseVersion: true }).extend({
        threadId: z.string(),
        expectedVersion: z.number().int().positive(),
      }),
      async ({ tx, args, ctx }) => {
        if (ctx.isAnonymous) throw new Error('document_requires_auth')
        const document = await tx.run(
          zql.document.where('id', args.documentId).one(),
        )
        if (
          !ownsDocument(document, {
            userId: ctx.userID,
            threadId: args.threadId,
            organizationId: ctx.organizationId,
          })
        )
          throw new Error('document_not_found')
        const thread = await tx.run(
          zql.thread
            .where('threadId', args.threadId)
            .where('userId', ctx.userID)
            .one(),
        )
        if (!thread || (thread.ownerOrgId ?? undefined) !== ctx.organizationId)
          throw new Error('document_not_found')
        if (thread.projectId) {
          const project = await tx.run(
            zql.project.where('id', thread.projectId).one(),
          )
          if (!project || project.deletedAt != null)
            throw new Error('document_not_found')
        }
        if (document.currentVersion !== args.expectedVersion)
          throw new Error('document_version_conflict')
        const version = document.currentVersion + 1
        const now = Date.now()
        await tx.mutate.documentVersion.insert({
          documentId: document.id,
          version,
          content: args.content,
          createdBy: 'user',
          createdAt: now,
        })
        await tx.mutate.document.update({
          id: document.id,
          currentVersion: version,
          updatedAt: now,
        })
      },
    ),
  },
}
