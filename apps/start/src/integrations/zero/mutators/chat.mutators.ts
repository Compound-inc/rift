import {
  defineMutator,
} from '@rocicorp/zero'
import { z } from 'zod'
import type { AiContextWindowMode } from '@/lib/shared/ai-catalog'
import { sanitizeThreadDisabledToolKeys } from '@/lib/shared/chat/tool-policy'
import { isChatModeId, resolveEffectiveChatMode } from '@/lib/shared/chat-modes'
import {
  DEFAULT_ORG_TOOL_POLICY,
  EMPTY_ORG_PROVIDER_KEY_STATUS
  
} from '@/lib/shared/model-policy/types'
import type {OrgPolicy} from '@/lib/shared/model-policy/types';
import { buildBootstrapThreadRecord } from '@/lib/shared/chat'
import { zql } from '../zql'
import {
  ROOT_BRANCH_PARENT_KEY
  
} from '@/lib/shared/chat-branching/branch-resolver'
import type {BranchSelection} from '@/lib/shared/chat-branching/branch-resolver';
import { isOrgMember, requireOrgContext } from '../org-access'

/**
 * Client-callable mutators only. All mutators here use ctx.userID for
 * ownership; no mutator trusts caller-provided user IDs. The one exception to
 * the older "server-only creation" rule is bootstrap thread creation: the
 * client now inserts the thread optimistically through Zero so the sidebar can
 * render from a single query-backed source of truth.
 */
const createThreadArgs = z.object({
  threadId: z.string().trim().min(1),
  createdAt: z.number().int().nonnegative(),
  modelId: z.string().trim().min(1),
  modeId: z.string().optional(),
  contextWindowMode: z.enum(['standard', 'max']).optional(),
  disabledToolKeys: z.array(z.string()),
})

const renameThreadArgs = z.object({
  threadId: z.string(),
  title: z.string().trim().min(1).max(160),
})

const archiveThreadArgs = z.object({
  threadId: z.string(),
})

const deleteThreadArgs = z.object({
  threadId: z.string(),
})

const setThreadPinnedArgs = z.object({
  threadId: z.string(),
  pinned: z.boolean(),
})

const selectBranchChildArgs = z.object({
  threadId: z.string(),
  parentMessageId: z.string(),
  childMessageId: z.string(),
  expectedBranchVersion: z.number().int().positive(),
})

const activateBranchPathArgs = z.object({
  threadId: z.string(),
  selections: z.array(
    z.object({
      parentMessageId: z.string(),
      childMessageId: z.string(),
    }),
  ),
  expectedBranchVersion: z.number().int().positive(),
})

const setThreadModeArgs = z.object({
  threadId: z.string(),
  modeId: z.string().nullable(),
})

const setThreadDisabledToolKeysArgs = z.object({
  threadId: z.string(),
  disabledToolKeys: z.array(z.string()),
})

const setThreadContextWindowModeArgs = z.object({
  threadId: z.string(),
  contextWindowMode: z.enum(['standard', 'max']),
})

/**
 * Builds the minimum org policy snapshot needed by tool-policy resolution from
 * Zero rows available inside a mutator transaction.
 */
function buildOrgToolPolicy(input: {
  organizationId?: string
  policyRow?: {
    organizationId?: string
    disabledProviderIds?: readonly string[]
    disabledModelIds?: readonly string[]
    complianceFlags?: Record<string, boolean>
    providerNativeToolsEnabled?: boolean | null
    externalToolsEnabled?: boolean | null
    disabledToolKeys?: readonly string[]
    enforcedModeId?: string | null
    updatedAt?: number
  } | null
}): OrgPolicy | undefined {
  const organizationId =
    input.organizationId?.trim() ??
    input.policyRow?.organizationId?.trim()
  if (!organizationId) return undefined

  return {
    organizationId,
    disabledProviderIds: input.policyRow?.disabledProviderIds ?? [],
    disabledModelIds: input.policyRow?.disabledModelIds ?? [],
    complianceFlags: input.policyRow?.complianceFlags ?? {},
    toolPolicy: {
      providerNativeToolsEnabled:
        input.policyRow?.providerNativeToolsEnabled ??
        DEFAULT_ORG_TOOL_POLICY.providerNativeToolsEnabled,
      externalToolsEnabled:
        input.policyRow?.externalToolsEnabled ??
        DEFAULT_ORG_TOOL_POLICY.externalToolsEnabled,
      disabledToolKeys:
        input.policyRow?.disabledToolKeys ??
        DEFAULT_ORG_TOOL_POLICY.disabledToolKeys,
    },
    enforcedModeId:
      input.policyRow?.enforcedModeId &&
      isChatModeId(input.policyRow.enforcedModeId)
        ? input.policyRow.enforcedModeId
        : undefined,
    orgKnowledgeEnabled: false,
    providerKeyStatus: EMPTY_ORG_PROVIDER_KEY_STATUS,
    updatedAt: input.policyRow?.updatedAt ?? Date.now(),
  }
}

function isThreadVisibleInContext(input: {
  readonly threadOwnerOrgId?: string | null
  readonly contextOrganizationId?: string
}): boolean {
  const scopedOrgId = input.contextOrganizationId?.trim()
  const threadOwnerOrgId = input.threadOwnerOrgId?.trim()

  if (scopedOrgId) {
    return threadOwnerOrgId === scopedOrgId
  }

  return !threadOwnerOrgId
}

type BranchMutatorTx = any

type BranchMutatorCtx = {
  readonly userID: string
  readonly organizationId?: string
  readonly isAnonymous?: boolean
}

async function loadScopedOwnedThread(input: {
  readonly tx: any
  readonly ctx: {
    readonly userID: string
    readonly organizationId?: string
    readonly isAnonymous?: boolean
  }
  readonly threadId: string
}) {
  const scoped = requireOrgContext(
    {
      organizationId: input.ctx.organizationId,
      userID: input.ctx.userID,
      isAnonymous: input.ctx.isAnonymous ?? false,
    },
    'Organization context is required to pin threads',
  )

  const organization = await input.tx.run(
    zql.organization
      .where('id', scoped.organizationId)
      .whereExists('members', isOrgMember(scoped.userID))
      .one(),
  )

  if (!organization) {
    return null
  }

  const thread = await input.tx.run(
    zql.thread
      .where('threadId', input.threadId)
      .where('userId', scoped.userID)
      .where('ownerOrgId', scoped.organizationId)
      .one(),
  )

  return thread ?? null
}

async function loadValidatedBranchThread(input: {
  readonly tx: BranchMutatorTx
  readonly ctx: BranchMutatorCtx
  readonly threadId: string
  readonly expectedBranchVersion: number
}) {
  const thread = (await input.tx.run(
    zql.thread.where('threadId', input.threadId).one(),
  )) as
    | {
        id: string
        userId: string
        ownerOrgId?: string | null
        branchVersion: number
        generationStatus: 'idle' | 'pending' | 'generation' | 'failed'
        activeChildByParent?: Record<string, string> | null
      }
    | null
  if (!thread || thread.userId !== input.ctx.userID) {
    return null
  }
  if (
    !isThreadVisibleInContext({
      threadOwnerOrgId: thread.ownerOrgId,
      contextOrganizationId: input.ctx.organizationId,
    })
  ) {
    return null
  }

  if (thread.branchVersion !== input.expectedBranchVersion) {
    throw new Error('branch_version_conflict')
  }
  if (
    thread.generationStatus === 'pending' ||
    thread.generationStatus === 'generation'
  ) {
    throw new Error('branch_switch_while_generating')
  }

  return thread
}

async function validateBranchSelection(
  input: {
    readonly tx: BranchMutatorTx
    readonly ctx: BranchMutatorCtx
    readonly threadId: string
  } & BranchSelection,
): Promise<boolean> {
  const parent = (await input.tx.run(
    zql.message
      .where('threadId', input.threadId)
      .where('messageId', input.parentMessageId)
      .where('userId', input.ctx.userID)
      .one(),
  )) as { messageId: string } | null
  if (input.parentMessageId !== ROOT_BRANCH_PARENT_KEY && !parent) {
    return false
  }

  const child = (await input.tx.run(
    zql.message
      .where('threadId', input.threadId)
      .where('messageId', input.childMessageId)
      .where('userId', input.ctx.userID)
      .one(),
  )) as { messageId: string; parentMessageId?: string | null } | null
  const parentMatch =
    input.parentMessageId === ROOT_BRANCH_PARENT_KEY
      ? !child?.parentMessageId
      : child?.parentMessageId === input.parentMessageId

  return Boolean(child && parentMatch)
}

export const chatMutatorDefinitions = {
  threads: {
    create: defineMutator(createThreadArgs, async ({ tx, args, ctx }) => {
      const existing = await tx.run(
        zql.thread.where('threadId', args.threadId).one(),
      )
      if (existing) {
        if (existing.userId !== ctx.userID) {
          throw new Error('thread_create_conflict_owner')
        }
        if (
          !isThreadVisibleInContext({
            threadOwnerOrgId: existing.ownerOrgId,
            contextOrganizationId: ctx.organizationId,
          })
        ) {
          throw new Error('thread_create_conflict_context')
        }
        return
      }

      const orgPolicyRow = ctx.organizationId
        ? await tx.run(
            zql.orgPolicy.where('organizationId', ctx.organizationId).one(),
          )
        : undefined
      const orgPolicy = buildOrgToolPolicy({
        organizationId: ctx.organizationId,
        policyRow: orgPolicyRow,
      })
      const threadModeId =
        typeof args.modeId === 'string' && isChatModeId(args.modeId)
          ? args.modeId
          : undefined
      const mode = resolveEffectiveChatMode({
        orgEnforcedModeId: orgPolicy?.enforcedModeId,
        threadModeId,
      })
      const disabledToolKeys = sanitizeThreadDisabledToolKeys({
        modelId: args.modelId,
        mode,
        orgPolicy,
        disabledToolKeys: args.disabledToolKeys,
      })

      try {
        await tx.mutate.thread.insert(
          buildBootstrapThreadRecord({
            threadId: args.threadId,
            createdAt: args.createdAt,
            userId: ctx.userID,
            modelId: args.modelId,
            modeId: threadModeId,
            contextWindowMode: args.contextWindowMode,
            organizationId: ctx.organizationId,
            disabledToolKeys,
          }),
        )
      } catch (error) {
        const current = await tx.run(
          zql.thread.where('threadId', args.threadId).one(),
        )
        if (
          current &&
          current.userId === ctx.userID &&
          isThreadVisibleInContext({
            threadOwnerOrgId: current.ownerOrgId,
            contextOrganizationId: ctx.organizationId,
          })
        ) {
          return
        }

        throw error
      }
    }),

    rename: defineMutator(renameThreadArgs, async ({ tx, args, ctx }) => {
      const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
      if (!thread || thread.userId !== ctx.userID) {
        return
      }
      if (
        !isThreadVisibleInContext({
          threadOwnerOrgId: thread.ownerOrgId,
          contextOrganizationId: ctx.organizationId,
        })
      ) {
        return
      }

      await tx.mutate.thread.update({
        id: thread.id,
        title: args.title,
        userSetTitle: true,
        updatedAt: Date.now(),
      })
    }),

    archive: defineMutator(archiveThreadArgs, async ({ tx, args, ctx }) => {
      const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
      if (!thread || thread.userId !== ctx.userID) {
        return
      }
      if (
        !isThreadVisibleInContext({
          threadOwnerOrgId: thread.ownerOrgId,
          contextOrganizationId: ctx.organizationId,
        })
      ) {
        return
      }

      await tx.mutate.thread.update({
        id: thread.id,
        visibility: 'archived',
        updatedAt: Date.now(),
      })
    }),

    setPinned: defineMutator(setThreadPinnedArgs, async ({ tx, args, ctx }) => {
      const thread = await loadScopedOwnedThread({
        tx,
        ctx,
        threadId: args.threadId,
      })
      if (!thread || thread.pinned === args.pinned) {
        return
      }

      await tx.mutate.thread.update({
        id: thread.id,
        pinned: args.pinned,
      })
    }),

    /** Permanently delete thread and all its messages. */
    delete: defineMutator(deleteThreadArgs, async ({ tx, args, ctx }) => {
      const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
      if (!thread || thread.userId !== ctx.userID) {
        return
      }
      if (
        !isThreadVisibleInContext({
          threadOwnerOrgId: thread.ownerOrgId,
          contextOrganizationId: ctx.organizationId,
        })
      ) {
        return
      }

      const messages = await tx.run(
        zql.message.where('threadId', args.threadId).where('userId', ctx.userID),
      )
      for (const message of messages) {
        await tx.mutate.message.delete({ id: message.id })
      }
      await tx.mutate.thread.delete({ id: thread.id })
    }),

    /**
     * Persist canonical branch selection for a parent message.
     * This mutator is optimistic-concurrency-safe via `expectedBranchVersion`.
     */
    selectBranchChild: defineMutator(
      selectBranchChildArgs,
      async ({ tx, args, ctx }) => {
        const thread = await loadValidatedBranchThread({
          tx,
          ctx,
          threadId: args.threadId,
          expectedBranchVersion: args.expectedBranchVersion,
        })
        if (!thread) {
          return
        }

        const isValidSelection = await validateBranchSelection({
          tx,
          ctx,
          threadId: args.threadId,
          parentMessageId: args.parentMessageId,
          childMessageId: args.childMessageId,
        })
        if (!isValidSelection) {
          return
        }

        const activeChildByParent =
          thread.activeChildByParent &&
          typeof thread.activeChildByParent === 'object'
            ? { ...thread.activeChildByParent }
            : {}

        if (activeChildByParent[args.parentMessageId] === args.childMessageId) {
          return
        }
        activeChildByParent[args.parentMessageId] = args.childMessageId

        await tx.mutate.thread.update({
          id: thread.id,
          activeChildByParent,
          branchVersion: thread.branchVersion + 1,
        })
      },
    ),

    /**
     * Atomically activates a full root->leaf branch path. Search reveal uses
     * this to make deeply nested hidden hits visible in one CAS-protected write.
     */
    activateBranchPath: defineMutator(
      activateBranchPathArgs,
      async ({ tx, args, ctx }) => {
        const thread = await loadValidatedBranchThread({
          tx,
          ctx,
          threadId: args.threadId,
          expectedBranchVersion: args.expectedBranchVersion,
        })
        if (!thread) {
          return
        }
        if (args.selections.length === 0) {
          return
        }

        const activeChildByParent =
          thread.activeChildByParent &&
          typeof thread.activeChildByParent === 'object'
            ? { ...thread.activeChildByParent }
            : {}
        let changed = false

        for (const selection of args.selections) {
          const isValidSelection = await validateBranchSelection({
            tx,
            ctx,
            threadId: args.threadId,
            parentMessageId: selection.parentMessageId,
            childMessageId: selection.childMessageId,
          })
          if (!isValidSelection) {
            return
          }

          if (
            activeChildByParent[selection.parentMessageId] ===
            selection.childMessageId
          ) {
            continue
          }

          activeChildByParent[selection.parentMessageId] =
            selection.childMessageId
          changed = true
        }

        if (!changed) {
          return
        }

        await tx.mutate.thread.update({
          id: thread.id,
          activeChildByParent,
          branchVersion: thread.branchVersion + 1,
        })
      },
    ),
    setMode: defineMutator(setThreadModeArgs, async ({ tx, args, ctx }) => {
      const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
      if (!thread || thread.userId !== ctx.userID) {
        return
      }
      if (
        !isThreadVisibleInContext({
          threadOwnerOrgId: thread.ownerOrgId,
          contextOrganizationId: ctx.organizationId,
        })
      ) {
        return
      }

      const nextModeId = args.modeId ?? null
      const currentModeId =
        typeof thread.modeId === 'string' ? thread.modeId : null
      if (currentModeId === nextModeId) {
        return
      }

      await tx.mutate.thread.update({
        id: thread.id,
        modeId: nextModeId,
      })
    }),

    setContextWindowMode: defineMutator(
      setThreadContextWindowModeArgs,
      async ({ tx, args, ctx }) => {
        const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
        if (!thread || thread.userId !== ctx.userID) {
          return
        }
        if (
          !isThreadVisibleInContext({
            threadOwnerOrgId: thread.ownerOrgId,
            contextOrganizationId: ctx.organizationId,
          })
        ) {
          return
        }

        const currentContextWindowMode =
          thread.contextWindowMode === 'max' ? 'max' : 'standard'
        const nextContextWindowMode =
          args.contextWindowMode as AiContextWindowMode
        if (currentContextWindowMode === nextContextWindowMode) {
          return
        }

        await tx.mutate.thread.update({
          id: thread.id,
          contextWindowMode: nextContextWindowMode,
          updatedAt: Date.now(),
        })
      },
    ),

    /**
     * Thread-local provider tool preferences are stored as disabled tool keys.
     * The mutator computes the canonical server-side value from the current
     * thread model/mode plus org policy so clients cannot bypass policy rules.
     */
    setDisabledToolKeys: defineMutator(
      setThreadDisabledToolKeysArgs,
      async ({ tx, args, ctx }) => {
        const thread = await tx.run(zql.thread.where('threadId', args.threadId).one())
        if (!thread || thread.userId !== ctx.userID) {
          return
        }
        if (
          !isThreadVisibleInContext({
            threadOwnerOrgId: thread.ownerOrgId,
            contextOrganizationId: ctx.organizationId,
          })
        ) {
          return
        }

        const orgPolicyRow = ctx.organizationId
          ? await tx.run(
              zql.orgPolicy.where('organizationId', ctx.organizationId).one(),
            )
          : undefined
        const orgPolicy = buildOrgToolPolicy({
          organizationId: ctx.organizationId,
          policyRow: orgPolicyRow,
        })
        const mode = resolveEffectiveChatMode({
          orgEnforcedModeId: orgPolicy?.enforcedModeId,
          threadModeId: typeof thread.modeId === 'string' ? thread.modeId : undefined,
        })
        const nextDisabledToolKeys = sanitizeThreadDisabledToolKeys({
          modelId: thread.model,
          mode,
          orgPolicy,
          disabledToolKeys: args.disabledToolKeys,
        })

        const currentDisabledToolKeys = Array.isArray(thread.disabledToolKeys)
          ? thread.disabledToolKeys
          : []
        const same =
          currentDisabledToolKeys.length === nextDisabledToolKeys.length &&
          currentDisabledToolKeys.every(
            (value, index) => value === nextDisabledToolKeys[index],
          )
        if (same) {
          return
        }

        await tx.mutate.thread.update({
          id: thread.id,
          disabledToolKeys: nextDisabledToolKeys,
        })
      },
    ),
  },

  /**
   * No client-callable message mutators. Thread/message creation and
   * assistant finalization are done only by the chat backend via the
   * Zero DB adapter (direct tx.mutate), not via this HTTP mutator API.
   */
  messages: {},
}
