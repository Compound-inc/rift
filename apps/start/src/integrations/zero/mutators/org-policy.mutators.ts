import {
  defineMutator,
} from '@rocicorp/zero'
import { z } from 'zod'
import { AI_CATALOG_BY_ID, AI_MODELS_BY_PROVIDER } from '@/lib/ai-catalog'
import { TOOL_CATALOG_BY_KEY } from '@/lib/ai-catalog/tool-catalog'
import {
  coerceWorkspacePlanId,
  getWorkspaceFeatureAccessState,
  getPlanEffectiveFeatures,
  type WorkspaceFeatureId,
} from '@/lib/billing/plan-catalog'
import { isChatModeId } from '@/lib/chat-modes'
import { zql } from '../zql'

const toggleProviderPolicyArgs = z.object({
  providerId: z.string().min(1),
  disabled: z.boolean(),
})

const toggleModelPolicyArgs = z.object({
  modelId: z.string().min(1),
  disabled: z.boolean(),
})

const toggleComplianceFlagArgs = z.object({
  flag: z.string().min(1),
  enabled: z.boolean(),
})

const setEnforcedModeArgs = z.object({
  modeId: z.string().min(1).nullable(),
})

const toggleProviderNativeToolsArgs = z.object({
  enabled: z.boolean(),
})

const toggleExternalToolsArgs = z.object({
  enabled: z.boolean(),
})

const toggleToolArgs = z.object({
  toolKey: z.string().min(1),
  disabled: z.boolean(),
})

type OrgPolicyRow = {
  id: string
  organizationId: string
  disabledProviderIds: readonly string[]
  disabledModelIds: readonly string[]
  complianceFlags: Record<string, boolean>
  providerNativeToolsEnabled?: boolean | null
  externalToolsEnabled?: boolean | null
  disabledToolKeys?: readonly string[]
  providerKeyStatus: {
    syncedAt: number
    hasAnyProviderKey: boolean
    providers: {
      openai: boolean
      anthropic: boolean
    }
  }
  enforcedModeId?: string | null
}

type OrgPolicySnapshot = {
  disabledProviderIds: readonly string[]
  disabledModelIds: readonly string[]
  complianceFlags: Record<string, boolean>
  providerNativeToolsEnabled: boolean
  externalToolsEnabled: boolean
  disabledToolKeys: readonly string[]
  providerKeyStatus: {
    syncedAt: number
    hasAnyProviderKey: boolean
    providers: {
      openai: boolean
      anthropic: boolean
    }
  }
  enforcedModeId?: string | null
}

type OrgEntitlementRow = {
  planId?: string
  effectiveFeatures?: Record<WorkspaceFeatureId, boolean>
}

/** De-duplicates identifiers while preserving insertion order. */
function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

/** Returns a new list without the target identifier. */
function remove(values: readonly string[], candidate: string): string[] {
  return values.filter((value) => value !== candidate)
}

/** Returns a new list with the target identifier appended if absent. */
function add(values: readonly string[], candidate: string): string[] {
  return unique([...values, candidate])
}

/** Throws when org-scoped mutators are called outside an active org context. */
function requireOrgWorkosId(ctx: { organizationId?: string }): string {
  const organizationId = ctx.organizationId?.trim()
  if (!organizationId) {
    throw new Error('Organization context is required to update policy')
  }
  return organizationId
}

async function requireOrgFeature(args: {
  tx: any
  organizationId: string
  feature: WorkspaceFeatureId
}) {
  const entitlement = await args.tx.run(
    zql.orgEntitlementSnapshot.where('organizationId', args.organizationId).one(),
  ) as OrgEntitlementRow | null | undefined

  const effectiveFeatures
    = entitlement?.effectiveFeatures
      ?? getPlanEffectiveFeatures(coerceWorkspacePlanId(entitlement?.planId))

  const access = getWorkspaceFeatureAccessState({
    planId: coerceWorkspacePlanId(entitlement?.planId),
    feature: args.feature,
    effectiveFeatures,
  })

  if (!access.allowed) {
    throw new Error(access.upgradeCallout)
  }
}

/** Normalizes an optional row into a complete policy snapshot with defaults. */
function toSnapshot(row?: OrgPolicyRow): OrgPolicySnapshot {
  return {
    disabledProviderIds: row?.disabledProviderIds ?? [],
    disabledModelIds: row?.disabledModelIds ?? [],
    complianceFlags: { ...(row?.complianceFlags ?? {}) },
    providerNativeToolsEnabled: row?.providerNativeToolsEnabled ?? true,
    externalToolsEnabled: row?.externalToolsEnabled ?? true,
    disabledToolKeys: row?.disabledToolKeys ?? [],
    providerKeyStatus: row?.providerKeyStatus ?? {
      syncedAt: 0,
      hasAnyProviderKey: false,
      providers: {
        openai: false,
        anthropic: false,
      },
    },
    enforcedModeId:
      row?.enforcedModeId && isChatModeId(row.enforcedModeId)
        ? row.enforcedModeId
        : undefined,
  }
}

/**
 * Persists a full policy snapshot.
 * Inserts when no row exists for the org yet, otherwise updates in-place.
 */
async function persistOrgPolicy(args: {
  tx: {
    mutate: {
      orgAiPolicy: {
        insert: (row: {
          id: string
          organizationId: string
          disabledProviderIds: readonly string[]
          disabledModelIds: readonly string[]
          complianceFlags: Record<string, boolean>
          providerNativeToolsEnabled: boolean
          externalToolsEnabled: boolean
          disabledToolKeys: readonly string[]
          providerKeyStatus: {
            syncedAt: number
            hasAnyProviderKey: boolean
            providers: {
              openai: boolean
              anthropic: boolean
            }
          }
          enforcedModeId?: string | null
          updatedAt: number
        }) => Promise<void>
        update: (row: {
          id: string
          disabledProviderIds: readonly string[]
          disabledModelIds: readonly string[]
          complianceFlags: Record<string, boolean>
          providerNativeToolsEnabled: boolean
          externalToolsEnabled: boolean
          disabledToolKeys: readonly string[]
          providerKeyStatus: {
            syncedAt: number
            hasAnyProviderKey: boolean
            providers: {
              openai: boolean
              anthropic: boolean
            }
          }
          enforcedModeId?: string | null
          updatedAt: number
        }) => Promise<void>
      }
    }
  }
  organizationId: string
  existing?: OrgPolicyRow
  next: OrgPolicySnapshot
}): Promise<void> {
  const updatedAt = Date.now()

  if (!args.existing) {
    await args.tx.mutate.orgAiPolicy.insert({
      id: crypto.randomUUID(),
      organizationId: args.organizationId,
      disabledProviderIds: args.next.disabledProviderIds,
      disabledModelIds: args.next.disabledModelIds,
      complianceFlags: args.next.complianceFlags,
      providerNativeToolsEnabled: args.next.providerNativeToolsEnabled,
      externalToolsEnabled: args.next.externalToolsEnabled,
      disabledToolKeys: args.next.disabledToolKeys,
      providerKeyStatus: args.next.providerKeyStatus,
      enforcedModeId: args.next.enforcedModeId ?? null,
      updatedAt,
    })
    return
  }

  await args.tx.mutate.orgAiPolicy.update({
    id: args.existing.id,
    disabledProviderIds: args.next.disabledProviderIds,
    disabledModelIds: args.next.disabledModelIds,
    complianceFlags: args.next.complianceFlags,
    providerNativeToolsEnabled: args.next.providerNativeToolsEnabled,
    externalToolsEnabled: args.next.externalToolsEnabled,
    disabledToolKeys: args.next.disabledToolKeys,
    providerKeyStatus: args.next.providerKeyStatus,
    enforcedModeId: args.next.enforcedModeId ?? null,
    updatedAt,
  })
}

/**
 * Organization policy mutators.
 * Every operation requires org context from authenticated Zero server context.
 */
export const orgPolicyMutatorDefinitions = {
  orgPolicy: {
    toggleProvider: defineMutator(toggleProviderPolicyArgs, async ({ tx, args, ctx }) => {
      const organizationId = requireOrgWorkosId(ctx)
      await requireOrgFeature({
        tx,
        organizationId,
        feature: 'providerPolicy',
      })
      if (!AI_MODELS_BY_PROVIDER.has(args.providerId)) {
        throw new Error(`Unknown provider id: ${args.providerId}`)
      }

      const existing = await tx.run(
        zql.orgAiPolicy.where('organizationId', organizationId).one(),
      )
      const snapshot = toSnapshot(existing)
      const next: OrgPolicySnapshot = {
        ...snapshot,
        disabledProviderIds: args.disabled
          ? add(snapshot.disabledProviderIds, args.providerId)
          : remove(snapshot.disabledProviderIds, args.providerId),
      }

      await persistOrgPolicy({
        tx,
        organizationId,
        existing,
        next,
      })
    }),

    toggleModel: defineMutator(toggleModelPolicyArgs, async ({ tx, args, ctx }) => {
      const organizationId = requireOrgWorkosId(ctx)
      await requireOrgFeature({
        tx,
        organizationId,
        feature: 'providerPolicy',
      })
      if (!AI_CATALOG_BY_ID.has(args.modelId)) {
        throw new Error(`Unknown model id: ${args.modelId}`)
      }

      const existing = await tx.run(
        zql.orgAiPolicy.where('organizationId', organizationId).one(),
      )
      const snapshot = toSnapshot(existing)
      const next: OrgPolicySnapshot = {
        ...snapshot,
        disabledModelIds: args.disabled
          ? add(snapshot.disabledModelIds, args.modelId)
          : remove(snapshot.disabledModelIds, args.modelId),
      }

      await persistOrgPolicy({
        tx,
        organizationId,
        existing,
        next,
      })
    }),

    toggleComplianceFlag: defineMutator(
      toggleComplianceFlagArgs,
      async ({ tx, args, ctx }) => {
        const organizationId = requireOrgWorkosId(ctx)
        await requireOrgFeature({
          tx,
          organizationId,
          feature: 'compliancePolicy',
        })

        const existing = await tx.run(
          zql.orgAiPolicy.where('organizationId', organizationId).one(),
        )
        const snapshot = toSnapshot(existing)
        const next: OrgPolicySnapshot = {
          ...snapshot,
          complianceFlags: {
            ...snapshot.complianceFlags,
            [args.flag]: args.enabled,
          },
        }

        await persistOrgPolicy({
          tx,
          organizationId,
          existing,
          next,
        })
      },
    ),
    setEnforcedMode: defineMutator(setEnforcedModeArgs, async ({ tx, args, ctx }) => {
      const organizationId = requireOrgWorkosId(ctx)
      await requireOrgFeature({
        tx,
        organizationId,
        feature: 'providerPolicy',
      })
      if (args.modeId && !isChatModeId(args.modeId)) {
        throw new Error(`Unknown mode id: ${args.modeId}`)
      }

      const existing = await tx.run(
        zql.orgAiPolicy.where('organizationId', organizationId).one(),
      )
      const snapshot = toSnapshot(existing)
      const next: OrgPolicySnapshot = {
        ...snapshot,
        enforcedModeId: args.modeId,
      }

      await persistOrgPolicy({
        tx,
        organizationId,
        existing,
        next,
      })
    }),
    toggleProviderNativeTools: defineMutator(
      toggleProviderNativeToolsArgs,
      async ({ tx, args, ctx }) => {
        const organizationId = requireOrgWorkosId(ctx)
        await requireOrgFeature({
          tx,
          organizationId,
          feature: 'toolPolicy',
        })
        const existing = await tx.run(
          zql.orgAiPolicy.where('organizationId', organizationId).one(),
        )
        const snapshot = toSnapshot(existing)
        const next: OrgPolicySnapshot = {
          ...snapshot,
          providerNativeToolsEnabled: args.enabled,
        }

        await persistOrgPolicy({
          tx,
          organizationId,
          existing,
          next,
        })
      },
    ),
    toggleExternalTools: defineMutator(
      toggleExternalToolsArgs,
      async ({ tx, args, ctx }) => {
        const organizationId = requireOrgWorkosId(ctx)
        await requireOrgFeature({
          tx,
          organizationId,
          feature: 'toolPolicy',
        })
        const existing = await tx.run(
          zql.orgAiPolicy.where('organizationId', organizationId).one(),
        )
        const snapshot = toSnapshot(existing)
        const next: OrgPolicySnapshot = {
          ...snapshot,
          externalToolsEnabled: args.enabled,
        }

        await persistOrgPolicy({
          tx,
          organizationId,
          existing,
          next,
        })
      },
    ),
    toggleTool: defineMutator(toggleToolArgs, async ({ tx, args, ctx }) => {
      const organizationId = requireOrgWorkosId(ctx)
      await requireOrgFeature({
        tx,
        organizationId,
        feature: 'toolPolicy',
      })
      if (!TOOL_CATALOG_BY_KEY.has(args.toolKey)) {
        throw new Error(`Unknown tool key: ${args.toolKey}`)
      }

      const existing = await tx.run(
        zql.orgAiPolicy.where('organizationId', organizationId).one(),
      )
      const snapshot = toSnapshot(existing)
      const next: OrgPolicySnapshot = {
        ...snapshot,
        disabledToolKeys: args.disabled
          ? add(snapshot.disabledToolKeys, args.toolKey)
          : remove(snapshot.disabledToolKeys, args.toolKey),
      }

      await persistOrgPolicy({
        tx,
        organizationId,
        existing,
        next,
      })
    }),
  },
}
