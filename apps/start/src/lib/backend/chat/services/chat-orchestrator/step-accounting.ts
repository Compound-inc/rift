import type { LanguageModelUsage } from 'ai'
import { buildPersistedGenerationAnalytics } from '../../domain/generation-metrics'
import type { PersistedGenerationAnalytics } from '../../domain/generation-metrics'
import { aggregateStepAccounting } from '../../domain/multi-step-accounting'
import { hasProviderWork } from './provider-work'
import { resolveStoppedUsage } from './stopped-usage'

export type CompletedModelStep = {
  readonly usage?: LanguageModelUsage
  readonly providerMetadata?: Record<string, unknown>
  readonly finishReason?: string
}

const totals = [
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'reasoningTokens',
  'textTokens',
  'cacheReadTokens',
  'cacheWriteTokens',
  'noCacheTokens',
  'billableWebSearchCalls',
] as const

/**
 * v7 rejects aggregate promises on abort. Capture each completed step before the
 * next provider call, then estimate only the unfinished step that emitted output.
 * This collector never settles a reservation; onEnd remains the single owner.
 */
export function createStepAccounting(input: {
  readonly modelId: string
  readonly usedByok: boolean
  readonly reservedNanoUsd?: number
}) {
  const completed: CompletedModelStep[] = []
  const settledSteps: PersistedGenerationAnalytics[] = []
  let promptTokens: number | undefined
  let text = ''
  let reasoning = ''
  let hasOutput = false
  let started = false

  function current(analytics?: PersistedGenerationAnalytics) {
    if (!hasProviderWork({ analytics, hasOutput })) return undefined
    return resolveStoppedUsage({
      ...input,
      analytics: {
        ...analytics,
        usedByok: input.usedByok,
        inputTokens: analytics?.inputTokens ?? promptTokens,
      },
      messages: [],
      text,
      reasoning,
    })
  }

  return {
    startStep(estimatedPromptTokens: number) {
      started = true
      promptTokens = estimatedPromptTokens
      text = ''
      reasoning = ''
      hasOutput = false
    },
    observe(chunk: unknown) {
      if (!chunk || typeof chunk !== 'object') return
      const part = chunk as { type?: string; text?: string; delta?: string }
      if (
        part.type &&
        /^(text-|reasoning-|tool-input-|tool-call$|tool-result$|tool-error$)/.test(
          part.type,
        )
      )
        hasOutput = true
      if (part.type === 'text-delta') text += part.text ?? ''
      if (part.type === 'reasoning-delta') reasoning += part.text ?? ''
      if (part.type === 'tool-input-delta') text += part.delta ?? ''
    },
    finishStep(step: CompletedModelStep) {
      completed.push(step)
      const analytics = current(
        buildPersistedGenerationAnalytics({
          ...step,
          usedByok: input.usedByok,
        }),
      )
      if (analytics) settledSteps.push(analytics)
      // A stop between calls must not estimate a new step that never ran.
      text = ''
      reasoning = ''
      hasOutput = false
      promptTokens = undefined
    },
    interrupted(): PersistedGenerationAnalytics | undefined {
      if (!started && !completed.length) return undefined
      const pending = current()
      const steps = [...settledSteps, ...(pending ? [pending] : [])]
      if (!steps.length) return undefined
      const sums = Object.fromEntries(
        totals.flatMap((key) => {
          const values = steps.flatMap((step) =>
            step[key] === undefined ? [] : [step[key]],
          )
          return values.length
            ? [[key, values.reduce((sum, value) => sum + value, 0)]]
            : []
        }),
      )
      const cost = steps.reduce(
        (sum, step) => sum + (step.aiCost ?? step.publicCost ?? 0),
        0,
      )
      return {
        ...sums,
        ...(input.usedByok ||
        steps.some((step) => step.publicCost !== undefined)
          ? { publicCost: cost }
          : { aiCost: cost }),
        usedByok: input.usedByok,
        providerMetadata: buildPersistedGenerationAnalytics({
          usedByok: input.usedByok,
          providerMetadata: aggregateStepAccounting(completed),
        }).providerMetadata,
      }
    },
  }
}
