import { getZeroDatabase, zql } from '@/lib/backend/chat/infra/zero/db'
import {
  isOrgProductPolicyEmpty,
  normalizeOrgProductPolicy,
  serializeOrgProductPolicy,
} from '@/lib/shared/org-product-policy'
import type { OrgProductKey } from '@/lib/shared/org-products'
import type {
  OrgProductPolicy,
  PersistedOrgProductPolicy,
} from '@/lib/shared/org-product-policy'

type OrgProductPolicyRow = {
  readonly id: string
  readonly organizationId: string
  readonly productKey: string
  readonly capabilities?: Record<string, unknown> | null
  readonly settings?: Record<string, unknown> | null
  readonly disabledProviderIds?: readonly unknown[] | null
  readonly disabledModelIds?: readonly unknown[] | null
  readonly disabledToolKeys?: readonly unknown[] | null
  readonly complianceFlags?: Record<string, unknown> | null
  readonly version?: number | null
  readonly updatedAt?: number | null
}

function now(): number {
  return Date.now()
}

function fromRow(row: OrgProductPolicyRow): PersistedOrgProductPolicy {
  return {
    organizationId: row.organizationId,
    productKey: row.productKey as OrgProductKey,
    version: row.version ?? 1,
    updatedAt: row.updatedAt ?? now(),
    ...normalizeOrgProductPolicy({
      capabilities: row.capabilities,
      settings: row.settings,
      disabledProviderIds: row.disabledProviderIds,
      disabledModelIds: row.disabledModelIds,
      disabledToolKeys: row.disabledToolKeys,
      complianceFlags: row.complianceFlags,
    }),
  }
}

export async function getOrgProductPolicy(
  organizationId: string,
  productKey: OrgProductKey,
): Promise<PersistedOrgProductPolicy | undefined> {
  const db = getZeroDatabase()
  if (!db) {
    throw new Error('ZERO_UPSTREAM_DB is not configured')
  }

  const row = await db.run(
    zql.orgProductPolicy
      .where('organizationId', organizationId)
      .where('productKey', productKey)
      .one(),
  )

  return row ? fromRow(row as OrgProductPolicyRow) : undefined
}

export async function upsertOrgProductPolicy(input: {
  readonly organizationId: string
  readonly productKey: OrgProductKey
  readonly policy: OrgProductPolicy
}): Promise<PersistedOrgProductPolicy | undefined> {
  const db = getZeroDatabase()
  if (!db) {
    throw new Error('ZERO_UPSTREAM_DB is not configured')
  }

  const existing = await db.run(
    zql.orgProductPolicy
      .where('organizationId', input.organizationId)
      .where('productKey', input.productKey)
      .one(),
  )

  const normalizedPolicy = normalizeOrgProductPolicy(input.policy)

  if (isOrgProductPolicyEmpty(normalizedPolicy)) {
    if (existing) {
      await db.transaction(async (tx) => {
        await tx.mutate.orgProductPolicy.delete({ id: existing.id })
      })
    }
    return undefined
  }

  const serialized = serializeOrgProductPolicy(normalizedPolicy)
  const updatedAt = now()
  const version = ((existing as OrgProductPolicyRow | null)?.version ?? 0) + 1

  if (!existing) {
    await db.transaction(async (tx) => {
      await tx.mutate.orgProductPolicy.insert({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        productKey: input.productKey,
        capabilities: serialized.capabilities ?? {},
        settings: serialized.settings ?? {},
        disabledProviderIds: serialized.disabledProviderIds ?? [],
        disabledModelIds: serialized.disabledModelIds ?? [],
        disabledToolKeys: serialized.disabledToolKeys ?? [],
        complianceFlags: serialized.complianceFlags ?? {},
        version,
        updatedAt,
      })
    })

    return {
      organizationId: input.organizationId,
      productKey: input.productKey,
      version,
      updatedAt,
      ...normalizedPolicy,
    }
  }

  await db.transaction(async (tx) => {
    await tx.mutate.orgProductPolicy.update({
      id: existing.id,
      capabilities: serialized.capabilities ?? {},
      settings: serialized.settings ?? {},
      disabledProviderIds: serialized.disabledProviderIds ?? [],
      disabledModelIds: serialized.disabledModelIds ?? [],
      disabledToolKeys: serialized.disabledToolKeys ?? [],
      complianceFlags: serialized.complianceFlags ?? {},
      version,
      updatedAt,
    })
  })

  return {
    organizationId: input.organizationId,
    productKey: input.productKey,
    version,
    updatedAt,
    ...normalizedPolicy,
  }
}
