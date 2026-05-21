import type { LanguageModelUsage } from 'ai'
import type { ReadonlyJSONValue } from '@rocicorp/zero'
import { canExposeUserCost } from '@/utils/app-feature-flags'

type UnknownRecord = Record<string, unknown>

export type PersistedGenerationAnalytics = {
  readonly providerMetadata?: ReadonlyJSONValue
  readonly generationMetadata?: ReadonlyJSONValue
  readonly aiCost?: number
  readonly publicCost?: number
  readonly usedByok: boolean
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly totalTokens?: number
  readonly reasoningTokens?: number
  readonly textTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
  readonly noCacheTokens?: number
  readonly billableWebSearchCalls?: number
}

export function buildPersistedGenerationAnalytics(input: {
  readonly usage?: LanguageModelUsage
  readonly providerMetadata?: unknown
  readonly usedByok: boolean
  readonly generationMetadata?: Record<string, ReadonlyJSONValue | undefined>
}): PersistedGenerationAnalytics {
  const providerMetadata = undefined
  const root = asRecord(input.providerMetadata)
  const gateway = asRecord(root?.gateway)
  const openrouter = asRecord(root?.openrouter)
  const openrouterUsage = asRecord(openrouter?.usage)
  const usage = normalizeUsage(input.usage, { openrouterUsage })
  const generationMetadata = undefined

  // Cost extraction priority order:
  //  1. AI Gateway: `providerMetadata.gateway.cost` is the canonical field.
  //  2. OpenRouter: usage accounting reports the actual credits cost in
  //     `providerMetadata.openrouter.usage.cost`. When the request is BYOK
  //     against OpenRouter, the upstream provider's passthrough cost is
  //     reported separately under `costDetails.upstreamInferenceCost`; we
  //     prefer that when present so settlement reflects what was paid to
  //     the underlying provider rather than OpenRouter credits used.
  const gatewayCost = asOptionalNumber(gateway?.cost)
  const openrouterCost = resolveOpenRouterCost(openrouterUsage)
  const rawCost = gatewayCost ?? openrouterCost
  const shouldExposeCost = input.usedByok || canExposeUserCost

  return {
    providerMetadata,
    generationMetadata,
    aiCost: shouldExposeCost ? undefined : rawCost,
    publicCost: shouldExposeCost ? rawCost : undefined,
    usedByok: input.usedByok,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens,
    textTokens: usage.outputTokenDetails.textTokens,
    cacheReadTokens: usage.inputTokenDetails.cacheReadTokens,
    cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens,
    noCacheTokens: usage.inputTokenDetails.noCacheTokens,
    billableWebSearchCalls: asOptionalNumber(gateway?.billableWebSearchCalls),
  }
}

/**
 * OpenRouter usage accounting reports the cost in two complementary fields:
 *   - `cost`: charges in OpenRouter credits (always present when usage
 *     accounting is enabled).
 *   - `costDetails.upstreamInferenceCost`: passthrough cost paid to the
 *     downstream provider when the user has BYOK configured at OpenRouter.
 *
 * For settlement purposes we want the cost that actually reflects spend, so
 * we prefer the upstream passthrough cost whenever it is reported. When the
 * BYOK passthrough is not used, both fields converge on the OpenRouter
 * credits cost.
 */
function resolveOpenRouterCost(
  openrouterUsage: UnknownRecord | undefined,
): number | undefined {
  if (!openrouterUsage) return undefined
  const upstream = asOptionalNumber(
    asRecord(openrouterUsage.costDetails)?.upstreamInferenceCost,
  )
  if (upstream !== undefined) return upstream
  return asOptionalNumber(openrouterUsage.cost)
}

function normalizeUsage(
  usage: LanguageModelUsage | undefined,
  context: { readonly openrouterUsage?: UnknownRecord } = {},
): LanguageModelUsage {
  // OpenRouter does not always populate the AI SDK's structured usage shape;
  // when fields are missing we hydrate from the provider metadata so the
  // analytics row is consistent regardless of which transport handled the
  // request.
  const openrouterUsage = context.openrouterUsage
  const openrouterPromptTokens = asOptionalNumber(
    openrouterUsage?.promptTokens,
  )
  const openrouterCompletionTokens = asOptionalNumber(
    openrouterUsage?.completionTokens,
  )
  const openrouterTotalTokens = asOptionalNumber(
    openrouterUsage?.totalTokens,
  )
  const openrouterCachedTokens = asOptionalNumber(
    asRecord(openrouterUsage?.promptTokensDetails)?.cachedTokens,
  )
  const openrouterReasoningTokens = asOptionalNumber(
    asRecord(openrouterUsage?.completionTokensDetails)?.reasoningTokens,
  )

  const inputTokens = usage?.inputTokens ?? openrouterPromptTokens
  const outputTokens = usage?.outputTokens ?? openrouterCompletionTokens
  const cacheReadTokens =
    usage?.inputTokenDetails.cacheReadTokens ?? openrouterCachedTokens
  const reasoningTokens =
    usage?.outputTokenDetails.reasoningTokens ?? openrouterReasoningTokens
  // Prefer explicit text-token count from the SDK; otherwise derive from
  // total output minus reasoning so callers always have a non-undefined
  // value when output and reasoning tokens are both known.
  const textTokens =
    usage?.outputTokenDetails.textTokens
    ?? (outputTokens !== undefined && reasoningTokens !== undefined
      ? Math.max(0, outputTokens - reasoningTokens)
      : undefined)
  // No-cache tokens default to inputTokens minus cacheReadTokens when not
  // explicitly reported, so OpenRouter responses fill the same column we
  // populate for AI Gateway responses.
  const noCacheTokens =
    usage?.inputTokenDetails.noCacheTokens
    ?? (inputTokens !== undefined && cacheReadTokens !== undefined
      ? Math.max(0, inputTokens - cacheReadTokens)
      : inputTokens)

  return {
    inputTokens,
    inputTokenDetails: {
      noCacheTokens,
      cacheReadTokens,
      cacheWriteTokens: usage?.inputTokenDetails.cacheWriteTokens,
    },
    outputTokens,
    outputTokenDetails: {
      textTokens,
      reasoningTokens,
    },
    totalTokens:
      usage?.totalTokens
      ?? openrouterTotalTokens
      ?? addDefined(inputTokens, outputTokens),
    raw: usage?.raw,
    reasoningTokens,
    cachedInputTokens: cacheReadTokens,
  }
}

function addDefined(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  return left == null && right == null ? undefined : (left ?? 0) + (right ?? 0)
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}
