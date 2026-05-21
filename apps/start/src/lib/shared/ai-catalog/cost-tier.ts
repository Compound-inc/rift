import type { AiModelCatalogEntry, AiModelPricing } from './types'

/**
 * Five-bucket cost classification surfaced in the model picker UI so users can
 * gauge relative spend without having to read raw $/token numbers.
 */
export type AiModelCostTier =
  | 'very_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'very_high'

/**
 * Token mix used to collapse separate input and output token prices into a
 * single representative number. A 3:1 input:output ratio approximates typical
 * chat usage where each turn re-sends the conversation history as input while
 * the model produces a comparatively short reply.
 */
const INPUT_TOKEN_WEIGHT = 3
const OUTPUT_TOKEN_WEIGHT = 1
const TOTAL_TOKEN_WEIGHT = INPUT_TOKEN_WEIGHT + OUTPUT_TOKEN_WEIGHT

const TOKENS_PER_MILLION = 1_000_000

/**
 * Tier upper bounds in USD per million tokens of blended cost. Anything above
 * the last bound is `very_high`. Bounds were chosen so that the catalog spread
 * — from sub-$0.20/M utility models up to ~$25/M flagship reasoning models —
 * lands across all five buckets rather than collapsing into the extremes.
 */
const COST_TIER_UPPER_BOUNDS_USD_PER_MILLION_TOKENS: ReadonlyArray<{
  readonly tier: AiModelCostTier
  readonly maxBlendedUsdPerMillion: number
}> = [
  { tier: 'very_low', maxBlendedUsdPerMillion: 0.5 },
  { tier: 'low', maxBlendedUsdPerMillion: 2 },
  { tier: 'medium', maxBlendedUsdPerMillion: 7 },
  { tier: 'high', maxBlendedUsdPerMillion: 20 },
]

/**
 * Returns the blended USD cost per million tokens, or undefined when pricing
 * data is missing or unparseable. The blended value uses {@link INPUT_TOKEN_WEIGHT}
 * and {@link OUTPUT_TOKEN_WEIGHT} so callers do not need to know the weighting.
 */
export function getBlendedCostUsdPerMillionTokens(
  pricing: AiModelPricing | undefined,
): number | undefined {
  if (!pricing) return undefined

  const inputPerToken = Number.parseFloat(pricing.inputPerToken)
  const outputPerToken = Number.parseFloat(pricing.outputPerToken)

  if (!Number.isFinite(inputPerToken) || !Number.isFinite(outputPerToken)) {
    return undefined
  }

  const blendedPerToken
    = (inputPerToken * INPUT_TOKEN_WEIGHT
      + outputPerToken * OUTPUT_TOKEN_WEIGHT)
    / TOTAL_TOKEN_WEIGHT

  return blendedPerToken * TOKENS_PER_MILLION
}

/**
 * Maps a blended USD-per-million-tokens cost to a discrete {@link AiModelCostTier}.
 * Exposed separately from {@link getModelCostTier} so consumers that already
 * have a blended cost (e.g. analytics aggregations) can reuse the bucketing.
 */
export function getCostTierForBlendedUsdPerMillionTokens(
  blendedUsdPerMillion: number,
): AiModelCostTier {
  for (const bound of COST_TIER_UPPER_BOUNDS_USD_PER_MILLION_TOKENS) {
    if (blendedUsdPerMillion <= bound.maxBlendedUsdPerMillion) {
      return bound.tier
    }
  }
  return 'very_high'
}

/**
 * Returns the cost tier for a catalog model, or undefined when the model has
 * no pricing metadata (e.g. user-supplied BYOK endpoints). Callers should
 * treat undefined as "do not show a cost indicator" rather than as a tier.
 */
export function getModelCostTier(
  model: Pick<AiModelCatalogEntry, 'pricing'>,
): AiModelCostTier | undefined {
  const blended = getBlendedCostUsdPerMillionTokens(model.pricing)
  if (blended === undefined) return undefined
  return getCostTierForBlendedUsdPerMillionTokens(blended)
}
