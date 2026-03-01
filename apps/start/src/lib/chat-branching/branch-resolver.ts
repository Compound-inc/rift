/**
 * Deterministic branch resolution helpers shared by backend orchestration and UI.
 *
 * The resolver treats message lineage as an immutable tree:
 * - `parentMessageId` defines edges.
 * - `activeChildByParent[parentId] = childId` selects the canonical branch.
 * - sibling ordering is stable by `(branchIndex, createdAt, messageId)`.
 */
export type BranchableMessage = {
  readonly messageId: string
  readonly role: 'user' | 'assistant' | 'system'
  readonly parentMessageId?: string | null
  readonly branchIndex: number
  readonly createdAt?: number | null
}

export type RegenerationAnchor = {
  readonly anchorMessageId: string
  readonly anchorRole: 'user'
  readonly targetMessageId: string
}

export type EditableUserTarget = {
  readonly targetMessageId: string
  readonly parentMessageId?: string
  readonly parentSelectionKey: string
  readonly siblingUserMessageIds: readonly string[]
}

export type BranchResolutionResult<TMessage extends BranchableMessage> = {
  readonly canonicalMessages: readonly TMessage[]
  readonly canonicalMessageIds: readonly string[]
  readonly selectedChildByParent: Record<string, string>
  readonly branchOptionsByParent: Record<string, readonly string[]>
}

/**
 * Synthetic parent slot used to persist canonical root selection.
 * This allows root-level user edits to behave exactly like any other branch.
 */
export const ROOT_BRANCH_PARENT_KEY = '__root__'

function sortBranchSiblings<TMessage extends BranchableMessage>(
  messages: readonly TMessage[],
): TMessage[] {
  return [...messages].sort((left, right) => {
    const leftBranch = left.branchIndex
    const rightBranch = right.branchIndex
    if (leftBranch !== rightBranch) {
      return leftBranch - rightBranch
    }

    const leftCreatedAt = left.createdAt ?? 0
    const rightCreatedAt = right.createdAt ?? 0
    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt
    }

    return left.messageId.localeCompare(right.messageId)
  })
}

export function normalizeActiveChildByParent(
  input: unknown,
): Record<string, string> {
  if (!input || typeof input !== 'object') return {}

  const entries = Object.entries(input as Record<string, unknown>)
  const normalizedEntries = entries.filter(
    ([parentId, childId]) =>
      parentId.trim().length > 0 &&
      typeof childId === 'string' &&
      childId.trim().length > 0,
  )

  return Object.fromEntries(normalizedEntries) as Record<string, string>
}

export function resolveCanonicalBranch<TMessage extends BranchableMessage>(
  messages: readonly TMessage[],
  activeChildByParentInput: unknown,
): BranchResolutionResult<TMessage> {
  const activeChildByParent = normalizeActiveChildByParent(
    activeChildByParentInput,
  )
  const byId = new Map(messages.map((message) => [message.messageId, message]))
  const childrenByParent = new Map<string, TMessage[]>()
  const roots: TMessage[] = []

  for (const message of messages) {
    const parentId =
      typeof message.parentMessageId === 'string' &&
      message.parentMessageId.trim().length > 0
        ? message.parentMessageId
        : null
    if (!parentId || !byId.has(parentId)) {
      roots.push(message)
      continue
    }
    const siblings = childrenByParent.get(parentId) ?? []
    siblings.push(message)
    childrenByParent.set(parentId, siblings)
  }

  for (const [parentId, siblings] of childrenByParent.entries()) {
    childrenByParent.set(parentId, sortBranchSiblings(siblings))
  }

  const sortedRoots = sortBranchSiblings(roots)
  const canonicalMessages: TMessage[] = []
  const canonicalIds: string[] = []
  const selectedChildByParent: Record<string, string> = {}
  const branchOptionsByParent: Record<string, readonly string[]> = {}

  if (sortedRoots.length === 0) {
    return {
      canonicalMessages,
      canonicalMessageIds: canonicalIds,
      selectedChildByParent,
      branchOptionsByParent,
    }
  }

  const selectedRootByActiveId = (() => {
    const activeRootId = activeChildByParent[ROOT_BRANCH_PARENT_KEY]
    if (!activeRootId) return undefined
    return sortedRoots.find((root) => root.messageId === activeRootId)
  })()
  const selectedRoot = selectedRootByActiveId ?? sortedRoots[0]

  if (sortedRoots.length > 1) {
    branchOptionsByParent[ROOT_BRANCH_PARENT_KEY] = sortedRoots.map(
      (root) => root.messageId,
    )
    selectedChildByParent[ROOT_BRANCH_PARENT_KEY] = selectedRoot.messageId
  }

  let current: TMessage | undefined = selectedRoot
  while (current) {
    canonicalMessages.push(current)
    canonicalIds.push(current.messageId)

    const children: TMessage[] = childrenByParent.get(current.messageId) ?? []
    if (children.length === 0) {
      current = undefined
      continue
    }

    branchOptionsByParent[current.messageId] = children.map(
      (child) => child.messageId,
    )

    const activeId: string | undefined = activeChildByParent[current.messageId]
    const selectedByActiveId: TMessage | undefined = activeId
      ? children.find((child) => child.messageId === activeId)
      : undefined
    if (!selectedByActiveId) {
      current = undefined
      continue
    }

    selectedChildByParent[current.messageId] = selectedByActiveId.messageId
    current = selectedByActiveId
  }

  return {
    canonicalMessages,
    canonicalMessageIds: canonicalIds,
    selectedChildByParent,
    branchOptionsByParent,
  }
}

/**
 * Regeneration always branches from a user anchor.
 * - Target user => anchor is the same user message.
 * - Target assistant => anchor is the assistant's parent user message.
 */
export function resolveRegenerationAnchor<TMessage extends BranchableMessage>(
  messages: readonly TMessage[],
  targetMessageId: string,
): RegenerationAnchor | null {
  const byId = new Map(messages.map((message) => [message.messageId, message]))
  const target = byId.get(targetMessageId)
  if (!target) return null

  if (target.role === 'user') {
    return {
      anchorMessageId: target.messageId,
      anchorRole: 'user',
      targetMessageId: target.messageId,
    }
  }

  if (target.role !== 'assistant') return null
  const parentId =
    typeof target.parentMessageId === 'string' &&
    target.parentMessageId.trim().length > 0
      ? target.parentMessageId
      : null
  if (!parentId) return null

  const parent = byId.get(parentId)
  if (!parent || parent.role !== 'user') return null

  return {
    anchorMessageId: parent.messageId,
    anchorRole: 'user',
    targetMessageId: target.messageId,
  }
}

/**
 * Edit is limited to canonical-path user messages to keep branching deterministic
 * and avoid mutating hidden sibling paths from stale UI state.
 */
export function resolveEditableUserTarget<TMessage extends BranchableMessage>(
  messages: readonly TMessage[],
  activeChildByParentInput: unknown,
  targetMessageId: string,
): EditableUserTarget | null {
  const byId = new Map(messages.map((message) => [message.messageId, message]))
  const target = byId.get(targetMessageId)
  if (!target || target.role !== 'user') return null

  const { canonicalMessageIds } = resolveCanonicalBranch(
    messages,
    activeChildByParentInput,
  )
  if (!canonicalMessageIds.includes(targetMessageId)) return null

  const parentMessageId =
    typeof target.parentMessageId === 'string' &&
    target.parentMessageId.trim().length > 0
      ? target.parentMessageId
      : undefined
  const parentSelectionKey = parentMessageId ?? ROOT_BRANCH_PARENT_KEY

  const siblingUserMessageIds = sortBranchSiblings(
    messages.filter((message) => {
      if (message.role !== 'user') return false
      const candidateParent =
        typeof message.parentMessageId === 'string' &&
        message.parentMessageId.trim().length > 0
          ? message.parentMessageId
          : undefined
      return candidateParent === parentMessageId
    }),
  ).map((message) => message.messageId)

  return {
    targetMessageId,
    parentMessageId,
    parentSelectionKey,
    siblingUserMessageIds,
  }
}
