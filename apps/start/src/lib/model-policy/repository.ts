import { getZeroDatabase, zql } from '@/lib/chat-backend/infra/zero/db'
import type { OrgAiPolicy } from './types'

function now() {
  return Date.now()
}

function fromRow(row: {
  readonly orgWorkosId: string
  readonly disabledProviderIds?: readonly string[]
  readonly disabledModelIds?: readonly string[]
  readonly complianceFlags?: Record<string, boolean>
  readonly version?: number
  readonly updatedAt?: number
}): OrgAiPolicy {
  return {
    orgWorkosId: row.orgWorkosId,
    disabledProviderIds: row.disabledProviderIds ?? [],
    disabledModelIds: row.disabledModelIds ?? [],
    complianceFlags: row.complianceFlags ?? {},
    version: row.version ?? 1,
    updatedAt: row.updatedAt ?? now(),
  }
}

export async function getOrgAiPolicy(
  orgWorkosId: string,
): Promise<OrgAiPolicy | undefined> {
  const db = getZeroDatabase()
  if (!db) {
    throw new Error('ZERO_UPSTREAM_DB is not configured')
  }

  const row = await db.run(
    zql.orgAiPolicy.where('orgWorkosId', orgWorkosId).one(),
  )

  if (!row) return undefined
  return fromRow(row)
}

export async function upsertOrgAiPolicy(input: {
  readonly orgWorkosId: string
  readonly disabledProviderIds: readonly string[]
  readonly disabledModelIds: readonly string[]
  readonly complianceFlags: Record<string, boolean>
}): Promise<OrgAiPolicy> {
  const db = getZeroDatabase()
  if (!db) {
    throw new Error('ZERO_UPSTREAM_DB is not configured')
  }

  const existing = await db.run(
    zql.orgAiPolicy.where('orgWorkosId', input.orgWorkosId).one(),
  )

  const updatedAt = now()

  if (!existing) {
    const insertedId = crypto.randomUUID()
    await db.transaction(async (tx) => {
      await tx.mutate.orgAiPolicy.insert({
        id: insertedId,
        orgWorkosId: input.orgWorkosId,
        disabledProviderIds: [...input.disabledProviderIds],
        disabledModelIds: [...input.disabledModelIds],
        complianceFlags: input.complianceFlags,
        version: 1,
        updatedAt,
      })
    })

    return {
      orgWorkosId: input.orgWorkosId,
      disabledProviderIds: [...input.disabledProviderIds],
      disabledModelIds: [...input.disabledModelIds],
      complianceFlags: input.complianceFlags,
      version: 1,
      updatedAt,
    }
  }

  const nextVersion = (existing.version ?? 1) + 1

  await db.transaction(async (tx) => {
    await tx.mutate.orgAiPolicy.update({
      id: existing.id,
      disabledProviderIds: [...input.disabledProviderIds],
      disabledModelIds: [...input.disabledModelIds],
      complianceFlags: input.complianceFlags,
      version: nextVersion,
      updatedAt,
    })
  })

  return {
    orgWorkosId: input.orgWorkosId,
    disabledProviderIds: [...input.disabledProviderIds],
    disabledModelIds: [...input.disabledModelIds],
    complianceFlags: input.complianceFlags,
    version: nextVersion,
    updatedAt,
  }
}
