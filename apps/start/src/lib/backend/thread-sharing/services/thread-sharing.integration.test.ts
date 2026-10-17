import { afterAll, describe, expect, it, vi } from 'vitest'
import { Pool } from 'pg'
import { zeroNodePg } from '@rocicorp/zero/server/adapters/pg'
import { Effect, Layer } from 'effect'
import { schema } from '@/integrations/zero/schema'
import { buildBootstrapThreadRecord } from '@/lib/shared/chat'
import { resolveCanonicalBranch } from '@/lib/shared/chat-branching/branch-resolver'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { RateLimitService } from '@/lib/backend/chat/services/rate-limit.service'
import { ThreadSharingService } from './thread-sharing.service'

vi.mock('@/lib/backend/self-host/instance-settings.service', () => ({
  getPublicInstanceEnvironmentSnapshot: vi.fn(async () => ({
    instanceMode: 'cloud',
    publicAppLocked: false,
  })),
}))

const connectionString = process.env.ZERO_UPSTREAM_DB
const describeWithDatabase = connectionString ? describe : describe.skip

/** Exercise Zero's actual Postgres writes so schema constraints cannot be bypassed by mocks. */
describeWithDatabase('shared chat forks against Postgres', () => {
  const pool = new Pool({ connectionString })
  const db = zeroNodePg(schema, pool)
  afterAll(async () => {
    await pool.end()
  })

  it('persists a complete canonical chain with valid branch indexes', async () => {
    const userId = `share-fork-test-${crypto.randomUUID()}`
    const threadId = crypto.randomUUID()
    const shareId = crypto.randomUUID().replaceAll('-', '')
    const now = Date.now()
    const messageIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
    const contents = ['Question', 'Answer', 'Followup']
    const activeChildByParent = {
      __root__: messageIds[0],
      [messageIds[0]]: messageIds[1],
      [messageIds[1]]: messageIds[2],
    }
    const layer = ThreadSharingService.layer.pipe(
      Layer.provide(Layer.mergeAll(
        Layer.succeed(ZeroDatabaseService, {
          getOrFail: Effect.succeed(db),
          withDatabase: (run) => run(db),
        }),
        Layer.succeed(RateLimitService, {
          assertAllowed: () => Effect.succeed({ allowed: true as const, remaining: 9 }),
        }),
      )),
    )

    try {
      await db.transaction(async (tx) => {
        await tx.mutate.thread.insert({
          ...buildBootstrapThreadRecord({ threadId, createdAt: now, userId, modelId: 'openai/gpt-4o' }),
          title: 'Integration share',
          shareId,
          shareStatus: 'active',
          orgOnly: false,
          sharedAt: now,
          activeChildByParent,
        })
        for (const [index, messageId] of messageIds.entries()) {
          await tx.mutate.message.insert({
            id: messageId,
            messageId,
            threadId,
            userId,
            role: index === 1 ? 'assistant' : 'user',
            content: contents[index],
            status: 'done',
            branchIndex: 1,
            parentMessageId: index === 0 ? undefined : messageIds[index - 1],
            created_at: now + index,
            model: 'openai/gpt-4o',
            attachmentsIds: [],
          })
        }
      })
      const fork = await Effect.runPromise(Effect.gen(function* () {
        const service = yield* ThreadSharingService
        return yield* service.fork({ shareId, viewer: { userId, isAnonymous: false } })
      }).pipe(Effect.provide(layer)))

      expect(fork.threadId).not.toBe(threadId)
      await db.transaction(async (tx) => {
        const thread = await tx.run(zql.thread.where('threadId', fork.threadId).one())
        const messages = await tx.run(zql.message.where('threadId', fork.threadId).orderBy('created_at', 'asc'))
        expect(messages).toHaveLength(contents.length)
        for (const message of messages) expect(message.branchIndex).toBeGreaterThanOrEqual(1)
        const canonical = resolveCanonicalBranch(
          messages.map((message) => ({ ...message, createdAt: message.created_at })),
          thread?.activeChildByParent,
        )
        expect(canonical.canonicalMessages.map((message) => message.content)).toEqual(contents)
        expect(canonical.canonicalMessageIds).toEqual(messages.map((message) => message.messageId))
      })
    } finally {
      // Remove only this test's rows, including any fork created before an assertion failed.
      await pool.query('DELETE FROM messages WHERE user_id = $1', [userId])
      await pool.query('DELETE FROM threads WHERE user_id = $1', [userId])
    }
  })
})
