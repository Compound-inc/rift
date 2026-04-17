export const ORG_PRODUCT_FEATURE_CATALOG = {
  writing: {
    defaultEnabled: true,
    description:
      'Long-form document collaboration surfaces such as the Witting workspace.',
  },
} as const

export type OrgProductFeatureKey = keyof typeof ORG_PRODUCT_FEATURE_CATALOG

export type OrgProductFeatureStateMap = Record<OrgProductFeatureKey, boolean>

export type OrgProductFeatureOverrideMap = Partial<OrgProductFeatureStateMap>

/**
 * Narrow runtime feature keys to the catalog-backed union so Zero mutations and
 * route guards only operate on features the app actually knows how to render.
 */
export function isOrgProductFeatureKey(
  value: string,
): value is OrgProductFeatureKey {
  return value in ORG_PRODUCT_FEATURE_CATALOG
}

/**
 * Filters arbitrary JSON into the catalog-backed override map. Unknown keys and
 * non-boolean payloads are ignored so stale rows remain forwards-compatible.
 */
export function normalizeOrgProductFeatureOverrides(
  input?: Record<string, unknown> | null,
): OrgProductFeatureOverrideMap {
  const overrides: OrgProductFeatureOverrideMap = {}

  if (!input) {
    return overrides
  }

  for (const [featureKey, value] of Object.entries(input)) {
    if (!isOrgProductFeatureKey(featureKey) || typeof value !== 'boolean') {
      continue
    }

    overrides[featureKey] = value
  }

  return overrides
}

/**
 * Expands sparse override storage into a complete feature-state snapshot using
 * catalog defaults for any key the organization has never customized.
 */
export function resolveOrgProductFeatureStates(
  overrides?: OrgProductFeatureOverrideMap | null,
): OrgProductFeatureStateMap {
  const normalizedOverrides = normalizeOrgProductFeatureOverrides(overrides)

  return Object.fromEntries(
    Object.entries(ORG_PRODUCT_FEATURE_CATALOG).map(([featureKey, config]) => [
      featureKey,
      normalizedOverrides[featureKey as OrgProductFeatureKey] ??
        config.defaultEnabled,
    ]),
  ) as OrgProductFeatureStateMap
}

/**
 * Stores only deviations from the catalog defaults so org rows stay small even
 * as the feature catalog grows over time.
 */
export function serializeOrgProductFeatureOverrides(
  states: OrgProductFeatureStateMap,
): OrgProductFeatureOverrideMap {
  const overrides: OrgProductFeatureOverrideMap = {}

  for (const [featureKey, config] of Object.entries(ORG_PRODUCT_FEATURE_CATALOG)) {
    const typedKey = featureKey as OrgProductFeatureKey
    if (states[typedKey] !== config.defaultEnabled) {
      overrides[typedKey] = states[typedKey]
    }
  }

  return overrides
}

/**
 * Applies one feature change against sparse override storage while preserving
 * the compact "only store deviations" representation.
 */
export function setOrgProductFeatureOverride(input: {
  readonly overrides?: OrgProductFeatureOverrideMap | null
  readonly featureKey: OrgProductFeatureKey
  readonly enabled: boolean
}): OrgProductFeatureOverrideMap {
  const nextStates = resolveOrgProductFeatureStates(input.overrides)
  nextStates[input.featureKey] = input.enabled
  return serializeOrgProductFeatureOverrides(nextStates)
}

export function getOrgProductFeatureDefault(
  featureKey: OrgProductFeatureKey,
): boolean {
  return ORG_PRODUCT_FEATURE_CATALOG[featureKey].defaultEnabled
}
