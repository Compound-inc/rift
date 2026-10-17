import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { MemoryError } from './domain'
import type { MemoryScope } from './domain'
import { memoryContainerTag } from './memory-client'

const ledgerError = () =>
  new MemoryError({
    operation: 'ledger',
    message: 'Memory ledger request failed',
  })

/** Durable targets outlive auth rows. Locks serialize registration with deletion triggers. */
export class MemoryLedgerService extends ServiceMap.Service<
  MemoryLedgerService,
  {
    register: (
      scope: MemoryScope,
      document?: { id: string; assistantMessageId: string },
    ) => Effect.Effect<boolean, MemoryError>
    queueDocument: (
      scope: MemoryScope,
      id: string,
    ) => Effect.Effect<void, MemoryError>
    reset: (
      userId: string,
      organizationId: string,
    ) => Effect.Effect<void, MemoryError>
  }
>()('chat-backend/MemoryLedgerService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const register = Effect.fn('MemoryLedgerService.register')(
        (
          scope: MemoryScope,
          document?: { id: string; assistantMessageId: string },
        ) =>
          sql
            .withTransaction(
              Effect.gen(function* () {
                const members =
                  yield* sql`SELECT id FROM member WHERE "userId" = ${scope.userId} AND "organizationId" = ${scope.organizationId} FOR SHARE`
                if (!members.length) return false
                yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([scope.organizationId, scope.userId])}, 0))`
                // First use may precede a preference row for a newly created member.
                yield* sql`INSERT INTO user_memory_preference (user_id, organization_id, enabled, generation, updated_at)
        SELECT ${scope.userId}, ${scope.organizationId}, COALESCE((SELECT memory_default_enabled FROM user_personalization WHERE user_id = ${scope.userId}), TRUE), 'initial', ${Date.now()}
        ON CONFLICT DO NOTHING`
                const preferences =
                  yield* sql`SELECT user_id FROM user_memory_preference WHERE user_id = ${scope.userId}
        AND organization_id = ${scope.organizationId} AND generation = ${scope.generation ?? 'initial'} FOR SHARE`
                if (!preferences.length) return false
                const namespace = memoryContainerTag(scope)
                yield* sql`INSERT INTO memory_namespaces (namespace, user_id, organization_id, generation)
        VALUES (${namespace}, ${scope.userId}, ${scope.organizationId}, ${scope.generation ?? 'initial'}) ON CONFLICT DO NOTHING`
                const active =
                  yield* sql`SELECT namespace FROM memory_namespaces WHERE namespace = ${namespace} AND status = 'active' FOR SHARE`
                if (!active.length) return false
                if (document) {
                  // Thread deletion locks the parent before cascading to messages.
                  // Match that order; the subquery only reads the message snapshot.
                  const threads =
                    yield* sql`SELECT thread_id FROM threads WHERE user_id = ${scope.userId}
          AND owner_org_id = ${scope.organizationId} AND thread_id = (
            SELECT thread_id FROM messages WHERE message_id = ${document.assistantMessageId} AND user_id = ${scope.userId}
          ) FOR SHARE`
                  if (!threads.length) return false
                  const messages =
                    yield* sql`SELECT thread_id FROM messages WHERE message_id = ${document.assistantMessageId}
          AND user_id = ${scope.userId} AND thread_id = ${threads[0].thread_id} FOR SHARE`
                  if (!messages.length) return false
                  yield* sql`INSERT INTO memory_documents (namespace, document_id, thread_id)
          VALUES (${namespace}, ${document.id}, ${messages[0].thread_id}) ON CONFLICT DO NOTHING`
                  const targets =
                    yield* sql`SELECT document_id FROM memory_documents WHERE namespace = ${namespace}
          AND document_id = ${document.id} AND status = 'active' FOR SHARE`
                  if (!targets.length) return false
                }
                return true
              }),
            )
            .pipe(Effect.mapError(ledgerError)),
      )

      return {
        register,
        queueDocument: Effect.fn('MemoryLedgerService.queueDocument')(
          (scope, id) =>
            sql`
        INSERT INTO memory_documents (namespace, document_id, thread_id, status, retired_at, next_attempt_at)
        VALUES (${memoryContainerTag(scope)}, ${id}, '', 'purge_pending', NOW(), NOW() + INTERVAL '30 seconds')
        ON CONFLICT (namespace, document_id) DO UPDATE SET status = 'purge_pending',
          retired_at = NOW(), next_attempt_at = NOW() + INTERVAL '30 seconds', purge_passes = 0
      `.pipe(Effect.asVoid, Effect.mapError(ledgerError)),
        ),
        reset: Effect.fn('MemoryLedgerService.reset')(
          (userId, organizationId) =>
            sql
              .withTransaction(
                Effect.gen(function* () {
                  const members =
                    yield* sql`SELECT id FROM member WHERE "userId" = ${userId} AND "organizationId" = ${organizationId} FOR SHARE`
                  if (!members.length) return yield* Effect.fail(ledgerError())
                  yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, userId])}, 0))`
                  // Lock the preference before rotation, matching register's lock order.
                  const [old] = yield* sql<{
                    generation: string
                  }>`SELECT generation FROM user_memory_preference WHERE user_id = ${userId} AND organization_id = ${organizationId} FOR UPDATE`
                  const scope = {
                    userId,
                    organizationId,
                    generation: old?.generation ?? 'initial',
                  }
                  yield* sql`INSERT INTO memory_namespaces (namespace, user_id, organization_id, generation)
          VALUES (${memoryContainerTag(scope)}, ${userId}, ${organizationId}, ${scope.generation}) ON CONFLICT DO NOTHING`
                  yield* sql`UPDATE memory_namespaces SET status = 'purge_pending', retired_at = NOW(),
          next_attempt_at = NOW() + INTERVAL '30 seconds', purge_passes = 0
          WHERE user_id = ${userId} AND organization_id = ${organizationId} AND status <> 'purged'`
                  const generation = crypto.randomUUID()
                  yield* sql`INSERT INTO user_memory_preference (user_id, organization_id, enabled, generation, retired_generations, updated_at)
          VALUES (${userId}, ${organizationId}, FALSE, ${generation}, '[]'::JSONB, ${Date.now()})
          ON CONFLICT (user_id, organization_id) DO UPDATE SET enabled = FALSE, generation = EXCLUDED.generation,
            retired_generations = '[]'::JSONB, updated_at = EXCLUDED.updated_at`
                  yield* sql`INSERT INTO memory_namespaces (namespace, user_id, organization_id, generation)
          VALUES (${memoryContainerTag({ userId, organizationId, generation })}, ${userId}, ${organizationId}, ${generation})`
                }),
              )
              .pipe(Effect.mapError(ledgerError)),
        ),
      }
    }),
  )
}
