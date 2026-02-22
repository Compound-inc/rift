import { defineMutatorsWithType, defineMutator } from '@rocicorp/zero'
import { createBuilder } from '@rocicorp/zero'
import { z } from 'zod'
import type { Schema } from './schema'
import { schema } from './schema'

const zql = createBuilder(schema)

/**
 * Mutators are intentionally server-authoritative for security:
 * - `ctx.userID` is always the source of truth for ownership.
 * - no mutator trusts caller-provided user IDs for access control.
 */
const createThreadArgs = z.object({
  id: z.string(),
  threadId: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastMessageAt: z.number(),
  generationStatus: z.enum([
    'pending',
    'generation',
    'completed',
    'failed',
  ]),
  visibility: z.enum(['visible', 'archived']),
  model: z.string(),
  pinned: z.boolean(),
})

const createUserMessageArgs = z.object({
  id: z.string(),
  messageId: z.string(),
  threadId: z.string(),
  content: z.string(),
  createdAt: z.number(),
  model: z.string(),
  attachmentsIds: z.array(z.string()).optional(),
})

const startAssistantArgs = z.object({
  id: z.string(),
  messageId: z.string(),
  threadId: z.string(),
  model: z.string(),
  createdAt: z.number(),
})

const finalizeAssistantArgs = z.object({
  messageId: z.string(),
  threadId: z.string(),
  ok: z.boolean(),
  finalContent: z.string(),
  errorMessage: z.string().optional(),
  finalizedAt: z.number(),
})

export const mutators = defineMutatorsWithType<Schema>()({
  threads: {
    create: defineMutator(createThreadArgs, async ({ tx, args, ctx }) => {
      await tx.mutate.thread.insert({
        id: args.id,
        threadId: args.threadId,
        title: args.title,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
        lastMessageAt: args.lastMessageAt,
        generationStatus: args.generationStatus,
        visibility: args.visibility,
        userId: ctx.userID,
        model: args.model,
        pinned: args.pinned,
      })
    }),
  },
  messages: {
    createUser: defineMutator(createUserMessageArgs, async ({ tx, args, ctx }) => {
      // Security boundary: only allow writes into threads owned by the authenticated user.
      const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
      if (!thread || thread.userId !== ctx.userID) {
        return
      }

      const existing = await tx.run(
        zql.message.where('messageId', args.messageId).where('userId', ctx.userID).one(),
      )
      if (existing) {
        return
      }

      await tx.mutate.message.insert({
        id: args.id,
        messageId: args.messageId,
        threadId: args.threadId,
        userId: ctx.userID,
        content: args.content,
        status: 'done',
        role: 'user',
        created_at: args.createdAt,
        updated_at: args.createdAt,
        model: args.model,
        attachmentsIds: args.attachmentsIds ?? [],
      })

      await tx.mutate.thread.update({
        id: thread.id,
        updatedAt: args.createdAt,
        lastMessageAt: args.createdAt,
      })
    }),
    startAssistant: defineMutator(startAssistantArgs, async ({ tx, args, ctx }) => {
      // Security boundary: only allow writes into threads owned by the authenticated user.
      const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
      if (!thread || thread.userId !== ctx.userID) {
        return
      }

      const existing = await tx.run(
        zql.message.where('messageId', args.messageId).where('userId', ctx.userID).one(),
      )
      if (existing) {
        return
      }

      await tx.mutate.message.insert({
        id: args.id,
        messageId: args.messageId,
        threadId: args.threadId,
        userId: ctx.userID,
        content: '',
        status: 'streaming',
        role: 'assistant',
        created_at: args.createdAt,
        updated_at: args.createdAt,
        model: args.model,
        attachmentsIds: [],
      })

      await tx.mutate.thread.update({
        id: thread.id,
        generationStatus: 'generation',
        updatedAt: args.createdAt,
        lastMessageAt: args.createdAt,
        model: args.model,
      })
    }),
    finalizeAssistant: defineMutator(finalizeAssistantArgs, async ({ tx, args, ctx }) => {
      // Security boundary: the thread must be owned by the authenticated user.
      const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
      if (!thread || thread.userId !== ctx.userID) {
        return
      }

      const existing = await tx.run(
        zql.message.where('messageId', args.messageId).where('userId', ctx.userID).one(),
      )
      if (!existing || existing.threadId !== args.threadId) {
        return
      }

      await tx.mutate.message.update({
        id: existing.id,
        content: args.finalContent,
        status: args.ok ? 'done' : 'error',
        updated_at: args.finalizedAt,
        serverError: args.ok
          ? undefined
          : {
              type: 'stream_error',
              message: args.errorMessage ?? 'Assistant stream failed',
            },
      })

      await tx.mutate.thread.update({
        id: thread.id,
        generationStatus: args.ok ? 'completed' : 'failed',
        updatedAt: args.finalizedAt,
        lastMessageAt: args.finalizedAt,
      })
    }),
    setThreadGenerationStatus: defineMutator(
      z.object({
        threadId: z.string(),
        status: z.enum(['failed', 'completed']),
        updatedAt: z.number(),
      }),
      async ({ tx, args, ctx }) => {
        const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
        if (!thread || thread.userId !== ctx.userID) {
          return
        }
        if (
          thread.generationStatus !== 'pending' &&
          thread.generationStatus !== 'generation'
        ) {
          return
        }
        await tx.mutate.thread.update({
          id: thread.id,
          generationStatus: args.status,
          updatedAt: args.updatedAt,
          lastMessageAt: args.updatedAt,
        })
      }),
  },
})
