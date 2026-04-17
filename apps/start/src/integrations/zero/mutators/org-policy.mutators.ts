import {
  defineMutator,
} from '@rocicorp/zero'
import { z } from 'zod'
import { isChatModeId } from '@/lib/shared/chat-modes'
import { DEFAULT_ORG_TOOL_POLICY } from '@/lib/shared/model-policy/types'
import {
  requireOrgSettingsAdmin,
} from './org-settings.helpers'
import { zql } from '../zql'

const toggleComplianceFlagArgs = z.object({
  flag: z.string().min(1),
  enabled: z.boolean(),
})

const setEnforcedModeArgs = z.object({
  modeId: z.string().min(1).nullable(),
})

type OrgPolicyRow = {
  id: string
  organizationId: string
  disabledProviderIds?: readonly string[]
  disabledModelIds?: readonly string[]
  complianceFlags: Record<string, boolean>
  providerNativeToolsEnabled?: boolean | null
  externalToolsEnabled?: boolean | null
  disabledToolKeys?: readonly string[]
  orgKnowledgeEnabled?: boolean | null
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
  orgKnowledgeEnabled: boolean
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

/** Normalizes an optional row into a complete policy snapshot with defaults. */
function toSnapshot(row?: OrgPolicyRow): OrgPolicySnapshot {
  return {
    disabledProviderIds: row?.disabledProviderIds ?? [],
    disabledModelIds: row?.disabledModelIds ?? [],
    complianceFlags: { ...(row?.complianceFlags ?? {}) },
    providerNativeToolsEnabled:
      row?.providerNativeToolsEnabled ??
      DEFAULT_ORG_TOOL_POLICY.providerNativeToolsEnabled,
    externalToolsEnabled:
      row?.externalToolsEnabled ?? DEFAULT_ORG_TOOL_POLICY.externalToolsEnabled,
    disabledToolKeys: row?.disabledToolKeys ?? DEFAULT_ORG_TOOL_POLICY.disabledToolKeys,
    orgKnowledgeEnabled: row?.orgKnowledgeEnabled ?? false,
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
      orgPolicy: {
        insert: (row: {
          id: string
          organizationId: string
          disabledProviderIds: readonly string[]
          disabledModelIds: readonly string[]
          complianceFlags: Record<string, boolean>
          providerNativeToolsEnabled: boolean
          externalToolsEnabled: boolean
          disabledToolKeys: readonly string[]
          orgKnowledgeEnabled: boolean
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
          orgKnowledgeEnabled: boolean
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
    await args.tx.mutate.orgPolicy.insert({
      id: crypto.randomUUID(),
      organizationId: args.organizationId,
      disabledProviderIds: args.next.disabledProviderIds,
      disabledModelIds: args.next.disabledModelIds,
      complianceFlags: args.next.complianceFlags,
      providerNativeToolsEnabled: args.next.providerNativeToolsEnabled,
      externalToolsEnabled: args.next.externalToolsEnabled,
      disabledToolKeys: args.next.disabledToolKeys,
      orgKnowledgeEnabled: args.next.orgKnowledgeEnabled,
      providerKeyStatus: args.next.providerKeyStatus,
      enforcedModeId: args.next.enforcedModeId ?? null,
      updatedAt,
    })
    return
  }

  await args.tx.mutate.orgPolicy.update({
    id: args.existing.id,
    disabledProviderIds: args.next.disabledProviderIds,
    disabledModelIds: args.next.disabledModelIds,
    complianceFlags: args.next.complianceFlags,
    providerNativeToolsEnabled: args.next.providerNativeToolsEnabled,
    externalToolsEnabled: args.next.externalToolsEnabled,
    disabledToolKeys: args.next.disabledToolKeys,
    orgKnowledgeEnabled: args.next.orgKnowledgeEnabled,
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
    toggleComplianceFlag: defineMutator(
      toggleComplianceFlagArgs,
      async ({ tx, args, ctx }) => {
        const { organizationId } = await requireOrgSettingsAdmin({
          tx,
          ctx,
        })

        const existing = await tx.run(
          zql.orgPolicy.where('organizationId', organizationId).one(),
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
      const { organizationId } = await requireOrgSettingsAdmin({
        tx,
        ctx,
      })
      if (args.modeId && !isChatModeId(args.modeId)) {
        throw new Error(`Unknown mode id: ${args.modeId}`)
      }

      const existing = await tx.run(
        zql.orgPolicy.where('organizationId', organizationId).one(),
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
  },
}
