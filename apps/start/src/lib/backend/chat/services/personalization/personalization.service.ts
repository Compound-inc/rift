import { Effect, Layer, ServiceMap } from 'effect'
import { zql } from '@/integrations/zero/zql'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { resolveMemoryPolicy } from '@/lib/shared/personalization/policy'
import { MemoryLedgerService } from './memory-ledger.service'
import { MemoryService } from './memory.service'
import { MemoryError } from './domain'
import type { MemoryScope } from './domain'

/** Loads fresh consent and org policy, so background saves honor changes during a turn. */
export class PersonalizationService extends ServiceMap.Service<
  PersonalizationService,
  {
    load: (
      userId: string,
      organizationId?: string,
    ) => Effect.Effect<
      {
        instructions:
          | {
              instructionsEnabled: boolean
              memoryDefaultEnabled?: boolean
              aboutYou: string
              responsePreferences: string
            }
          | null
          | undefined
        scope: MemoryScope | undefined
        policy: ReturnType<typeof resolveMemoryPolicy>
      },
      MemoryError
    >
    reset: (
      userId: string,
      organizationId: string,
    ) => Effect.Effect<void, MemoryError>
  }
>()('chat-backend/PersonalizationService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const database = yield* ZeroDatabaseService
      const memory = yield* MemoryService
      const ledger = yield* MemoryLedgerService
      const load = Effect.fn('PersonalizationService.load')(
        (userId: string, organizationId?: string) =>
          database
            .withDatabase((db) =>
              Effect.tryPromise({
                try: async () => {
                  const instructions = await db.run(
                    zql.userPersonalization.where('userId', userId).one(),
                  )
                  // Custom instructions work without a vendor key or workspace.
                  // Skip all memory-policy queries when recall/save are unavailable.
                  if (!memory.configured || !organizationId) {
                    return {
                      instructions,
                      scope: undefined,
                      policy: resolveMemoryPolicy({
                        configured: memory.configured,
                        organizationId,
                      }),
                    }
                  }
                  const [preference, org, membership] = await Promise.all([
                    db.run(
                      zql.userMemoryPreference
                        .where('userId', userId)
                        .where('organizationId', organizationId)
                        .one(),
                    ),
                    db.run(
                      zql.orgAiPolicy
                        .where('organizationId', organizationId)
                        .one(),
                    ),
                    db.run(
                      zql.member
                        .where('userId', userId)
                        .where('organizationId', organizationId)
                        .one(),
                    ),
                  ])
                  return {
                    instructions,
                    scope:
                      organizationId && membership
                        ? {
                            userId,
                            organizationId,
                            generation: preference?.generation ?? 'initial',
                          }
                        : undefined,
                    policy: resolveMemoryPolicy({
                      configured: memory.configured,
                      organizationId: membership ? organizationId : undefined,
                      orgMemoryEnabled: org?.memoryEnabled,
                      requireZdr: Boolean(org?.complianceFlags.require_zdr),
                      userEnabled:
                        preference?.enabled ??
                        instructions?.memoryDefaultEnabled,
                    }),
                  }
                },
                catch: () =>
                  new MemoryError({
                    operation: 'load_preferences',
                    message: 'Could not load personalization',
                  }),
              }),
            )
            .pipe(
              Effect.mapError(
                () =>
                  new MemoryError({
                    operation: 'load_preferences',
                    message: 'Could not load personalization',
                  }),
              ),
            ),
      )

      return {
        load,
        reset: Effect.fn('PersonalizationService.reset')(
          (userId: string, organizationId: string) =>
            Effect.gen(function* () {
              yield* ledger.reset(userId, organizationId)
            }),
        ),
      }
    }),
  )
}
