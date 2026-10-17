import { Duration, Effect, Fiber, Layer, Option, ServiceMap } from 'effect'
import { runDetachedObserved } from '@/lib/backend/server-effect/runtime/detached'
import { EMPTY_RECALL } from './domain'
import type { MemoryScope } from './domain'
import { MemoryLedgerService } from './memory-ledger.service'
import { MemoryService } from './memory.service'
import { PersonalizationService } from './personalization.service'
import {
  buildPersonalizationSections,
  personalizationTokenBudget,
} from './prompt-sections'
import type { PersonalizationSections } from './prompt-sections'

const reportFailure = () => Effect.logWarning('chat_personalization_failed')
// Shared by all runtime instances. Saturation drops work rather than queueing
// stale consent checks or retaining unbounded conversation text in memory.
let savesInFlight = 0
export const MAX_MEMORY_SAVES = 8
const emptySections = buildPersonalizationSections({ recall: EMPTY_RECALL })

type RecallInput = {
  userId: string
  organizationId?: string
  userText: string
}

/** A ready result for disabled memory, or a join of recall already running alongside RAG. */
export type PersonalizationRecall = {
  sections: Effect.Effect<PersonalizationSections>
  preferences: Effect.Effect<{ scope?: MemoryScope; tokenBudget: number }>
}

type RememberTurnInput = RecallInput & {
  scope: MemoryScope | undefined
  assistantMessageId: string
  assistantText: string
  /** True when any supplied attachment/RAG context or tool could appear in the answer. */
  userTextOnly: boolean
}

/** Capture dependencies once so stream callbacks can save without a runtime context. */
export class PersonalizationTurnService extends ServiceMap.Service<
  PersonalizationTurnService,
  {
    startRecall: (input: RecallInput) => Effect.Effect<PersonalizationRecall>
    rememberTurn: (input: RememberTurnInput) => Effect.Effect<void>
  }
>()('chat-backend/PersonalizationTurnService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const memory = yield* MemoryService
      const ledger = yield* MemoryLedgerService
      const personalization = yield* PersonalizationService

      return {
        startRecall: Effect.fn('PersonalizationTurnService.startRecall')(
          function* (input): Effect.fn.Return<PersonalizationRecall> {
            // Fork consent reads as well as remote recall. History/RAG loading can
            // start immediately; joining preferences later only waits for local reads.
            const deadline = Date.now() + 800
            const loadedFiber = yield* personalization
              .load(input.userId, input.organizationId)
              .pipe(
                Effect.timeoutOption(Duration.millis(800)),
                Effect.tap((result) =>
                  Option.isNone(result)
                    ? Effect.logWarning('chat_personalization_timeout')
                    : Effect.void,
                ),
                Effect.catch(() =>
                  reportFailure().pipe(Effect.as(Option.none())),
                ),
                Effect.map((loaded) => {
                  const preferences = Option.getOrUndefined(loaded)
                  const sections = buildPersonalizationSections({
                    instructions: preferences?.instructions,
                    recall: EMPTY_RECALL,
                  })
                  const scope =
                    memory.configured &&
                    preferences?.policy.enabled &&
                    input.userText.trim()
                      ? preferences.scope
                      : undefined
                  return {
                    sections,
                    scope,
                  }
                }),
                Effect.forkChild,
              )
            const loaded = Fiber.join(loadedFiber)
            const recallFiber = yield* Effect.gen(function* () {
              const preferences = yield* loaded
              const remainingMs = deadline - Date.now()
              if (!preferences.scope || remainingMs <= 0)
                return preferences.sections
              return yield* memory
                .retrieve(preferences.scope, input.userText)
                .pipe(
                  Effect.map((recall) => ({
                    ...preferences.sections,
                    memorySection: buildPersonalizationSections({ recall })
                      .memorySection,
                  })),
                  Effect.timeoutOption(Duration.millis(remainingMs)),
                  Effect.flatMap((sections) =>
                    Option.isSome(sections)
                      ? Effect.succeed(sections.value)
                      : Effect.logWarning('chat_personalization_timeout').pipe(
                          Effect.as(preferences.sections),
                        ),
                  ),
                  Effect.catch(() =>
                    reportFailure().pipe(Effect.as(preferences.sections)),
                  ),
                )
            }).pipe(Effect.forkChild)
            return {
              sections: Fiber.join(recallFiber),
              // Join the same bounded recall used by assembly. Empty/failed recall
              // adds no allowance, and CJK text uses the shared token estimator.
              preferences: Effect.gen(function* () {
                const { scope } = yield* loaded
                const sections = yield* Fiber.join(recallFiber)
                return { scope, tokenBudget: personalizationTokenBudget(sections) }
              }),
            }
          },
        ),
        rememberTurn: Effect.fn('PersonalizationTurnService.rememberTurn')(
          (input) => {
            const scope = input.scope
            if (
              !memory.configured ||
              !scope ||
              !input.userText.trim() ||
              !input.assistantText.trim()
            )
              return Effect.void

            return Effect.suspend(() => {
              if (savesInFlight >= MAX_MEMORY_SAVES)
                return Effect.logWarning('chat_memory_save_saturated')
              savesInFlight += 1
              return runDetachedObserved({
                effect: Effect.gen(function* () {
                  // A reset retires the generation captured before recall. A later
                  // response must never repopulate it or write into the new namespace.
                  const latest = yield* personalization.load(
                    input.userId,
                    input.organizationId,
                  )
                  if (
                    !latest.policy.enabled ||
                    !latest.scope ||
                    latest.scope.generation !== scope.generation
                  )
                    return
                  const registered = yield* ledger.register(latest.scope, {
                    id: `turn:${input.assistantMessageId}`,
                    assistantMessageId: input.assistantMessageId,
                  })
                  if (!registered) return
                  yield* memory.saveTurn(latest.scope, {
                    id: `turn:${input.assistantMessageId}`,
                    userText: input.userText,
                    assistantText: input.userTextOnly
                      ? ''
                      : input.assistantText,
                  })
                }).pipe(
                  Effect.ensuring(
                    Effect.sync(() => {
                      savesInFlight -= 1
                    }),
                  ),
                ),
                onFailure: reportFailure,
                onTimeout: reportFailure,
                timeout: Duration.seconds(10),
              })
            })
          },
        ),
      }
    }),
  )

  static readonly layerNoop = Layer.succeed(this, {
    startRecall: () =>
      Effect.succeed({
        sections: Effect.succeed(emptySections),
        preferences: Effect.succeed({ tokenBudget: 0 }),
      }),
    rememberTurn: () => Effect.void,
  })
}
