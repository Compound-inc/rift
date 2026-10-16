import { Effect, Layer, ServiceMap } from 'effect'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import type { ServerAuthContext } from '@/lib/backend/server-effect/http/auth-context'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import type { ZeroServerTransaction } from '@/lib/backend/chat/infra/zero/db'
import { activateShare } from '@/lib/shared/thread-sharing/share'
import type { SharedThread } from '@/lib/shared/thread-sharing/share'
import { buildBootstrapThreadRecord } from '@/lib/shared/chat'
import { ROOT_BRANCH_PARENT_KEY } from '@/lib/shared/chat-branching/branch-resolver'
import {
  ShareActionError,
  SharePersistenceError,
  ShareUnavailableError,
} from '../domain/errors'
import { RateLimitService } from '@/lib/backend/chat/services/rate-limit.service'
import {
  FORK_WINDOW_MS,
  loadOwnedThread,
  loadSharedThread,
  publicAppLocked,
  publicPolicyAllowed,
  sanitizeForkText,
  sourceOrganizations,
  unavailable,
} from './thread-sharing/helpers'
import type { OwnerInput } from './thread-sharing/helpers'

import type {
  ActivationBlockedReason,
  PublicSharingBlockedReason,
} from '@/lib/shared/thread-sharing/reasons'

type ShareFailure =
  | ShareUnavailableError
  | SharePersistenceError
  | ShareActionError
export type ShareSettings = {
  shareId: string | null
  orgOnly: boolean
  shareName: boolean
  hasOrganization: boolean
  publicSharingAllowed: boolean
  publicSharingBlockedReason: PublicSharingBlockedReason | null
  activationBlockedReason: ActivationBlockedReason | null
}

function settings(
  thread: {
    shareId?: string | null
    shareStatus?: string | null
    orgOnly?: boolean | null
    shareName?: boolean | null
    ownerOrgId?: string | null
  },
  publicSharingAllowed = true,
  publicSharingBlockedReason: PublicSharingBlockedReason | null = null,
  activationBlockedReason: ActivationBlockedReason | null = null,
): ShareSettings {
  return {
    shareId: thread.shareStatus === 'active' ? (thread.shareId ?? null) : null,
    orgOnly: thread.orgOnly ?? Boolean(thread.ownerOrgId),
    shareName: thread.shareName ?? false,
    hasOrganization: Boolean(thread.ownerOrgId),
    publicSharingAllowed,
    publicSharingBlockedReason,
    activationBlockedReason,
  }
}

type ThreadSharingServiceShape = {
  readonly read: (input: {
    shareId: string
    viewer: ServerAuthContext
  }) => Effect.Effect<SharedThread, ShareFailure>
  readonly manage: (
    input: OwnerInput & {
      action: 'settings' | 'activate' | 'revoke'
      orgOnly?: boolean
      shareName?: boolean
    },
  ) => Effect.Effect<ShareSettings, ShareFailure>
  readonly fork: (input: {
    shareId: string
    viewer: ServerAuthContext
  }) => Effect.Effect<{ threadId: string }, ShareFailure>
}

/** All reads recheck status and membership; no shared content enters Zero's public queries. */
export class ThreadSharingService extends ServiceMap.Service<
  ThreadSharingService,
  ThreadSharingServiceShape
>()('thread-sharing/ThreadSharingService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const database = yield* ZeroDatabaseService
      const rateLimit = yield* RateLimitService
      const transaction = <T>(run: (tx: ZeroServerTransaction) => Promise<T>) =>
        database.getOrFail.pipe(
          Effect.mapError(
            () => new SharePersistenceError({ message: 'Sharing unavailable' }),
          ),
          Effect.flatMap((db) =>
            Effect.tryPromise({
              try: () => db.transaction(run),
              catch: (error) =>
                error instanceof ShareUnavailableError ||
                error instanceof ShareActionError
                  ? error
                  : new SharePersistenceError({
                      message: 'Sharing unavailable',
                    }),
            }),
          ),
        )
      return {
        read: Effect.fn('ThreadSharingService.read')(({ shareId, viewer }) =>
          transaction(
            async (tx) =>
              (await loadSharedThread(tx, shareId, viewer)).snapshot,
          ),
        ),
        manage: Effect.fn('ThreadSharingService.manage')((input) =>
          transaction(async (tx) => {
            const thread = await loadOwnedThread(tx, input)
            const locked = await publicAppLocked()
            const policyAllowed = await publicPolicyAllowed(
              tx,
              sourceOrganizations(thread),
            )
            const publicSharingAllowed = !locked && policyAllowed
            const blockedReason = locked
              ? 'instance_locked'
              : !policyAllowed
                ? 'workspace_policy'
                : null
            const activationBlockedReason = input.viewer.isAnonymous
              ? 'anonymous_owner'
              : null
            const currentSettings = (value: Parameters<typeof settings>[0]) =>
              settings(
                value,
                publicSharingAllowed,
                blockedReason,
                activationBlockedReason,
              )
            if (input.action === 'settings') return currentSettings(thread)
            if (input.action === 'revoke') {
              await tx.mutate.thread.update({
                id: thread.id,
                shareStatus: 'revoked',
              })
              return currentSettings({ ...thread, shareStatus: 'revoked' })
            }
            if (activationBlockedReason)
              throw new ShareActionError({
                code: activationBlockedReason,
                message: 'Anonymous owners cannot share conversations',
              })
            const orgOnly =
              Boolean(thread.ownerOrgId) &&
              (input.orgOnly ?? thread.orgOnly ?? true)
            if (!orgOnly && !publicSharingAllowed)
              throw new ShareActionError({
                code: blockedReason!,
                message: `Public sharing blocked: ${blockedReason}`,
              })
            const update = {
              ...activateShare(
                thread,
                Date.now(),
                () =>
                  crypto.randomUUID().replaceAll('-', '') +
                  crypto.randomUUID().replaceAll('-', ''),
              ),
              orgOnly,
              shareName: input.shareName ?? thread.shareName ?? false,
            }
            await tx.mutate.thread.update({ id: thread.id, ...update })
            return currentSettings({ ...thread, ...update })
          }),
        ),
        fork: Effect.fn('ThreadSharingService.fork')(({ shareId, viewer }) =>
          Effect.gen(function* () {
            if (!viewer.userId || viewer.isAnonymous)
              return yield* Effect.fail(unavailable())
            const userId = viewer.userId
            yield* rateLimit
              .assertAllowed({
                userId: `share-fork:${userId}`,
                requestId: crypto.randomUUID(),
                windowMs: 60_000,
                maxRequests: 10,
              })
              .pipe(
                Effect.mapError((error) =>
                  error._tag === 'RateLimitExceededError'
                    ? new ShareActionError({
                        code: 'rate_limited',
                        message:
                          'Too many requests to continue shared chats. Try again in a minute.',
                      })
                    : new SharePersistenceError({
                        message: 'Sharing unavailable',
                      }),
                ),
              )
            return yield* transaction(async (tx) => {
              // Serialize matching requests across replicas before looking for a recent copy.
              await tx.dbTransaction.wrappedTransaction.query(
                'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
                [
                  JSON.stringify([
                    userId,
                    shareId,
                    viewer.organizationId ?? null,
                  ]),
                ],
              )
              const { thread, snapshot, publicSharingAllowed } =
                await loadSharedThread(tx, shareId, viewer)
              if (
                (thread.orgOnly || !publicSharingAllowed) &&
                viewer.organizationId !== thread.ownerOrgId
              ) {
                throw new ShareActionError({
                  code: 'wrong_workspace',
                  message:
                    'Switch to the workspace that owns this conversation to continue it.',
                })
              }
              if (viewer.organizationId) {
                const member = await tx.run(
                  zql.member
                    .where('organizationId', viewer.organizationId)
                    .where('userId', userId)
                    .one(),
                )
                if (!member) throw unavailable()
              }
              const recent = await tx.dbTransaction.wrappedTransaction.query<{
                thread_id: string
              }>(
                `
              SELECT thread_id FROM threads
              WHERE user_id = $1 AND share_provenance->>'shareId' = $2
                AND owner_org_id IS NOT DISTINCT FROM $3 AND created_at >= $4
              ORDER BY created_at DESC LIMIT 1
            `,
                [
                  userId,
                  shareId,
                  viewer.organizationId ?? null,
                  Date.now() - FORK_WINDOW_MS,
                ],
              )
              if (recent.rows[0]) return { threadId: recent.rows[0].thread_id }
              const threadId = crypto.randomUUID()
              const now = Date.now()
              const activeChildByParent: Record<string, string> = {}
              let parentMessageId: string | undefined
              await tx.mutate.thread.insert({
                ...buildBootstrapThreadRecord({
                  threadId,
                  createdAt: now,
                  userId,
                  organizationId: viewer.organizationId,
                  modelId: thread.model,
                }),
                shareProvenance: {
                  shareId,
                  threadId: thread.threadId,
                  organizationIds: sourceOrganizations(thread),
                },
                title: snapshot.title,
                userSetTitle: true,
                generationStatus: 'completed',
              })
              for (const [index, message] of snapshot.messages.entries()) {
                const id = crypto.randomUUID()
                activeChildByParent[parentMessageId ?? ROOT_BRANCH_PARENT_KEY] =
                  id
                await tx.mutate.message.insert({
                  id,
                  messageId: id,
                  threadId,
                  userId,
                  role: message.role,
                  content: sanitizeForkText(message.text),
                  status: 'done',
                  parentMessageId,
                  branchIndex: 0,
                  created_at: now + index,
                  model: thread.model,
                  attachmentsIds: [],
                })
                parentMessageId = id
              }
              await tx.mutate.thread.update({
                id: threadId,
                activeChildByParent,
              })
              return { threadId }
            })
          }),
        ),
      }
    }),
  )
}
