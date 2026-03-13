import { getZeroDatabase, zql } from '@/lib/backend/chat/infra/zero/db'
import { isChatModeId  } from '@/lib/shared/chat-modes'
import type {ChatModeId} from '@/lib/shared/chat-modes';
import {
  DEFAULT_ORG_TOOL_POLICY,
  EMPTY_ORG_PROVIDER_KEY_STATUS
  
  
  
} from '@/lib/shared/model-policy/types'
import type {OrgAiPolicy, OrgProviderKeyStatusSnapshot, OrgToolPolicy} from '@/lib/shared/model-policy/types';

/** Uses epoch milliseconds to align with existing Zero schema timestamp columns. */
function now() {
  return Date.now()
}

/**
 * Normalizes partially populated DB rows into a fully shaped policy object.
 * This keeps policy consumers free from null/undefined branching.
 */
function fromRow(row: {
  readonly organizationId: string
  readonly disabledProviderIds?: readonly string[]
  readonly disabledModelIds?: readonly string[]
  readonly complianceFlags?: Record<string, boolean>
  readonly providerNativeToolsEnabled?: boolean | null
  readonly externalToolsEnabled?: boolean | null
  readonly disabledToolKeys?: readonly string[]
  readonly orgKnowledgeEnabled?: boolean | null
  readonly providerKeyStatus?: OrgProviderKeyStatusSnapshot
  readonly enforcedModeId?: string | null
  readonly updatedAt?: number
}): OrgAiPolicy {
  const enforcedModeId = row.enforcedModeId
  const normalizedModeId =
    typeof enforcedModeId === 'string' && isChatModeId(enforcedModeId)
      ? enforcedModeId
      : undefined

  const providerKeyStatus = row.providerKeyStatus
    ? {
        syncedAt: row.providerKeyStatus.syncedAt ?? 0,
        hasAnyProviderKey: Boolean(row.providerKeyStatus.hasAnyProviderKey),
        providers: {
          openai: Boolean(row.providerKeyStatus.providers?.openai),
          anthropic: Boolean(row.providerKeyStatus.providers?.anthropic),
        },
      }
    : EMPTY_ORG_PROVIDER_KEY_STATUS

  const toolPolicy: OrgToolPolicy = {
    providerNativeToolsEnabled:
      row.providerNativeToolsEnabled ??
      DEFAULT_ORG_TOOL_POLICY.providerNativeToolsEnabled,
    externalToolsEnabled:
      row.externalToolsEnabled ?? DEFAULT_ORG_TOOL_POLICY.externalToolsEnabled,
    disabledToolKeys:
      row.disabledToolKeys ?? DEFAULT_ORG_TOOL_POLICY.disabledToolKeys,
  }

  return {
    organizationId: row.organizationId,
    disabledProviderIds: row.disabledProviderIds ?? [],
    disabledModelIds: row.disabledModelIds ?? [],
    complianceFlags: row.complianceFlags ?? {},
    toolPolicy,
    orgKnowledgeEnabled: row.orgKnowledgeEnabled ?? false,
    providerKeyStatus,
    enforcedModeId: normalizedModeId,
    updatedAt: row.updatedAt ?? now(),
  }
}

/** Loads the latest policy snapshot for an org. */
export async function getOrgAiPolicy(
  organizationId: string,
): Promise<OrgAiPolicy | undefined> {
  const db = getZeroDatabase()
  if (!db) {
    throw new Error('ZERO_UPSTREAM_DB is not configured')
  }

  const row = await db.run(
    zql.orgAiPolicy.where('organizationId', organizationId).one(),
  )

  if (!row) return undefined
  return fromRow(row)
}

/**
 * Inserts or updates org policy. No versioning; policy is overwritten on each update.
 */
export async function upsertOrgAiPolicy(input: {
  readonly organizationId: string
  readonly disabledProviderIds: readonly string[]
  readonly disabledModelIds: readonly string[]
  readonly complianceFlags: Record<string, boolean>
  readonly toolPolicy: OrgToolPolicy
  readonly orgKnowledgeEnabled?: boolean
  readonly providerKeyStatus: OrgProviderKeyStatusSnapshot
  readonly enforcedModeId?: ChatModeId | null
}): Promise<OrgAiPolicy> {
  const db = getZeroDatabase()
  if (!db) {
    throw new Error('ZERO_UPSTREAM_DB is not configured')
  }

  const existing = await db.run(
    zql.orgAiPolicy.where('organizationId', input.organizationId).one(),
  )

  const updatedAt = now()

  if (!existing) {
    const insertedId = crypto.randomUUID()
    await db.transaction(async (tx) => {
      await tx.mutate.orgAiPolicy.insert({
        id: insertedId,
        organizationId: input.organizationId,
        disabledProviderIds: [...input.disabledProviderIds],
        disabledModelIds: [...input.disabledModelIds],
        complianceFlags: input.complianceFlags,
        providerNativeToolsEnabled: input.toolPolicy.providerNativeToolsEnabled,
        externalToolsEnabled: input.toolPolicy.externalToolsEnabled,
        disabledToolKeys: [...input.toolPolicy.disabledToolKeys],
        orgKnowledgeEnabled: input.orgKnowledgeEnabled ?? false,
        providerKeyStatus: input.providerKeyStatus,
        enforcedModeId: input.enforcedModeId ?? null,
        updatedAt,
      })
    })

    return {
      organizationId: input.organizationId,
      disabledProviderIds: [...input.disabledProviderIds],
      disabledModelIds: [...input.disabledModelIds],
      complianceFlags: input.complianceFlags,
      toolPolicy: {
        providerNativeToolsEnabled:
          input.toolPolicy.providerNativeToolsEnabled,
        externalToolsEnabled: input.toolPolicy.externalToolsEnabled,
        disabledToolKeys: [...input.toolPolicy.disabledToolKeys],
      },
      orgKnowledgeEnabled: input.orgKnowledgeEnabled ?? false,
      providerKeyStatus: input.providerKeyStatus,
      enforcedModeId: input.enforcedModeId ?? undefined,
      updatedAt,
    }
  }

  await db.transaction(async (tx) => {
    await tx.mutate.orgAiPolicy.update({
      id: existing.id,
      disabledProviderIds: [...input.disabledProviderIds],
      disabledModelIds: [...input.disabledModelIds],
      complianceFlags: input.complianceFlags,
      providerNativeToolsEnabled: input.toolPolicy.providerNativeToolsEnabled,
      externalToolsEnabled: input.toolPolicy.externalToolsEnabled,
      disabledToolKeys: [...input.toolPolicy.disabledToolKeys],
      orgKnowledgeEnabled: input.orgKnowledgeEnabled ?? false,
      providerKeyStatus: input.providerKeyStatus,
      enforcedModeId: input.enforcedModeId ?? null,
      updatedAt,
    })
  })

  return {
    organizationId: input.organizationId,
    disabledProviderIds: [...input.disabledProviderIds],
    disabledModelIds: [...input.disabledModelIds],
    complianceFlags: input.complianceFlags,
    toolPolicy: {
      providerNativeToolsEnabled: input.toolPolicy.providerNativeToolsEnabled,
      externalToolsEnabled: input.toolPolicy.externalToolsEnabled,
      disabledToolKeys: [...input.toolPolicy.disabledToolKeys],
    },
    orgKnowledgeEnabled: input.orgKnowledgeEnabled ?? false,
    providerKeyStatus: input.providerKeyStatus,
    enforcedModeId: input.enforcedModeId ?? undefined,
    updatedAt,
  }
}
