import { isOrgProductKey } from '@/lib/shared/org-products'
import type { OrgProductKey } from '@/lib/shared/org-products'

export type OrgProductPolicyScalar = string | number | boolean | null

export type OrgProductPolicy = {
  readonly capabilities: Readonly<Record<string, boolean>>
  readonly settings: Readonly<Record<string, OrgProductPolicyScalar>>
  readonly disabledProviderIds: readonly string[]
  readonly disabledModelIds: readonly string[]
  readonly disabledToolKeys: readonly string[]
  readonly complianceFlags: Readonly<Record<string, boolean>>
}

export type PersistedOrgProductPolicy = OrgProductPolicy & {
  readonly organizationId: string
  readonly productKey: OrgProductKey
  readonly version: number
  readonly updatedAt: number
}

export const EMPTY_ORG_PRODUCT_POLICY: OrgProductPolicy = {
  capabilities: {},
  settings: {},
  disabledProviderIds: [],
  disabledModelIds: [],
  disabledToolKeys: [],
  complianceFlags: {},
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function normalizeBooleanRecord(
  input?: Record<string, unknown> | null,
): Record<string, boolean> {
  const normalized: Record<string, boolean> = {}

  if (!input) {
    return normalized
  }

  for (const [key, value] of Object.entries(input)) {
    if (typeof key !== 'string' || key.length === 0 || typeof value !== 'boolean') {
      continue
    }

    normalized[key] = value
  }

  return normalized
}

function normalizeScalarRecord(
  input?: Record<string, unknown> | null,
): Record<string, OrgProductPolicyScalar> {
  const normalized: Record<string, OrgProductPolicyScalar> = {}

  if (!input) {
    return normalized
  }

  for (const [key, value] of Object.entries(input)) {
    if (typeof key !== 'string' || key.length === 0) {
      continue
    }

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      normalized[key] = value
    }
  }

  return normalized
}

function normalizeStringList(input?: readonly unknown[] | null): readonly string[] {
  if (!input) {
    return []
  }

  return unique(
    input.filter((value): value is string => typeof value === 'string' && value.length > 0),
  )
}

/**
 * Filters arbitrary JSON into the supported product-policy sections. This lets
 * us accept stale rows safely while still preserving a compact storage shape.
 */
export function normalizeOrgProductPolicy(
  input?: {
    readonly capabilities?: Record<string, unknown> | null
    readonly settings?: Record<string, unknown> | null
    readonly disabledProviderIds?: readonly unknown[] | null
    readonly disabledModelIds?: readonly unknown[] | null
    readonly disabledToolKeys?: readonly unknown[] | null
    readonly complianceFlags?: Record<string, unknown> | null
  } | null,
): OrgProductPolicy {
  return {
    capabilities: normalizeBooleanRecord(input?.capabilities),
    settings: normalizeScalarRecord(input?.settings),
    disabledProviderIds: normalizeStringList(input?.disabledProviderIds),
    disabledModelIds: normalizeStringList(input?.disabledModelIds),
    disabledToolKeys: normalizeStringList(input?.disabledToolKeys),
    complianceFlags: normalizeBooleanRecord(input?.complianceFlags),
  }
}

/**
 * Storage omits empty sections so each org/product row stays compact even as we
 * add more policy buckets over time.
 */
export function serializeOrgProductPolicy(
  policy: OrgProductPolicy,
): Partial<OrgProductPolicy> {
  const normalized = normalizeOrgProductPolicy(policy)

  return {
    ...(Object.keys(normalized.capabilities).length > 0
      ? { capabilities: normalized.capabilities }
      : {}),
    ...(Object.keys(normalized.settings).length > 0
      ? { settings: normalized.settings }
      : {}),
    ...(normalized.disabledProviderIds.length > 0
      ? { disabledProviderIds: normalized.disabledProviderIds }
      : {}),
    ...(normalized.disabledModelIds.length > 0
      ? { disabledModelIds: normalized.disabledModelIds }
      : {}),
    ...(normalized.disabledToolKeys.length > 0
      ? { disabledToolKeys: normalized.disabledToolKeys }
      : {}),
    ...(Object.keys(normalized.complianceFlags).length > 0
      ? { complianceFlags: normalized.complianceFlags }
      : {}),
  }
}

export function isOrgProductPolicyEmpty(
  input?: OrgProductPolicy | null,
): boolean {
  const normalized = normalizeOrgProductPolicy(input)

  return (
    Object.keys(normalized.capabilities).length === 0 &&
    Object.keys(normalized.settings).length === 0 &&
    normalized.disabledProviderIds.length === 0 &&
    normalized.disabledModelIds.length === 0 &&
    normalized.disabledToolKeys.length === 0 &&
    Object.keys(normalized.complianceFlags).length === 0
  )
}

/**
 * Product-specific policy can only add restrictions relative to broader org
 * defaults, so merged lists/maps prefer overlay values while preserving the
 * base policy for keys not explicitly overridden.
 */
export function mergeOrgProductPolicy(input: {
  readonly base?: OrgProductPolicy | null
  readonly override?: OrgProductPolicy | null
}): OrgProductPolicy {
  const base = normalizeOrgProductPolicy(input.base)
  const override = normalizeOrgProductPolicy(input.override)

  return {
    capabilities: {
      ...base.capabilities,
      ...override.capabilities,
    },
    settings: {
      ...base.settings,
      ...override.settings,
    },
    disabledProviderIds: unique([
      ...base.disabledProviderIds,
      ...override.disabledProviderIds,
    ]),
    disabledModelIds: unique([
      ...base.disabledModelIds,
      ...override.disabledModelIds,
    ]),
    disabledToolKeys: unique([
      ...base.disabledToolKeys,
      ...override.disabledToolKeys,
    ]),
    complianceFlags: {
      ...base.complianceFlags,
      ...override.complianceFlags,
    },
  }
}

export function isPersistedOrgProductPolicyRow(input: {
  readonly organizationId?: string
  readonly productKey?: string
}): input is {
  readonly organizationId: string
  readonly productKey: OrgProductKey
} {
  return (
    typeof input.organizationId === 'string' &&
    input.organizationId.length > 0 &&
    typeof input.productKey === 'string' &&
    isOrgProductKey(input.productKey)
  )
}
