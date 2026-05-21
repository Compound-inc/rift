import { DEFAULT_CONTEXT_WINDOW_MODE } from '@/lib/shared/ai-catalog'
import type { AiContextWindowMode } from '@/lib/shared/ai-catalog/types'
import { isChatModeId } from '@/lib/shared/chat-modes'
import type { ChatModeId } from '@/lib/shared/chat-modes'

export const DEFAULT_THREAD_TITLE = 'Nuevo Chat'

export type BootstrapThreadRecord = {
  readonly id: string
  readonly threadId: string
  readonly title: string
  readonly createdAt: number
  readonly updatedAt: number
  readonly lastMessageAt: number
  readonly generationStatus: 'pending' | 'completed'
  readonly visibility: 'visible'
  readonly userSetTitle: false
  readonly userId: string
  readonly model: string
  readonly reasoningEffort: undefined
  readonly modeId?: ChatModeId
  readonly contextWindowMode: AiContextWindowMode
  readonly pinned: false
  readonly allowAttachments: true
  readonly activeChildByParent: Record<string, string>
  readonly branchVersion: 1
  readonly ownerOrgId?: string
  readonly disabledToolKeys: readonly string[]
  readonly projectId?: string
}

type BootstrapThreadInput = {
  readonly threadId: string
  readonly createdAt: number
  readonly userId: string
  readonly modelId: string
  readonly modeId?: string | null
  readonly contextWindowMode?: AiContextWindowMode | null
  readonly organizationId?: string
  readonly disabledToolKeys?: readonly string[]
  readonly projectId?: string
  /**
   * Bootstrap status. Defaults to `'pending'` for the first-message-creates-
   * the-thread flow (a generation is about to start). Pass `'completed'`
   * when pre-creating a thread that has no generation pending yet (e.g. the
   * project page's "new chat in project" button), otherwise the chat
   * client will try to resume a non-existent stream before the server has
   * observed the new row.
   */
  readonly bootstrapStatus?: 'pending' | 'completed'
}

/**
 * Thread bootstrap rows must use deterministic IDs so client-side optimistic
 * creation, Zero mutator replay, and the server's create-if-missing fallback
 * all converge on the same record instead of briefly materializing duplicates.
 */
export function buildBootstrapThreadRecord(
  input: BootstrapThreadInput,
): BootstrapThreadRecord {
  const modelId = input.modelId.trim()
  if (!modelId) {
    throw new Error('missing_bootstrap_model_id')
  }

  const organizationId = input.organizationId?.trim() || undefined
  const modeId =
    typeof input.modeId === 'string' && isChatModeId(input.modeId)
      ? input.modeId
      : undefined
  const disabledToolKeys = [...new Set(input.disabledToolKeys ?? [])]

  return {
    id: input.threadId,
    threadId: input.threadId,
    title: DEFAULT_THREAD_TITLE,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    lastMessageAt: input.createdAt,
    generationStatus: input.bootstrapStatus ?? 'pending',
    visibility: 'visible',
    userSetTitle: false,
    userId: input.userId,
    model: modelId,
    reasoningEffort: undefined,
    modeId,
    contextWindowMode:
      input.contextWindowMode ?? DEFAULT_CONTEXT_WINDOW_MODE,
    pinned: false,
    allowAttachments: true,
    activeChildByParent: {},
    branchVersion: 1,
    ownerOrgId: organizationId,
    disabledToolKeys,
    projectId: input.projectId?.trim() || undefined,
  }
}
