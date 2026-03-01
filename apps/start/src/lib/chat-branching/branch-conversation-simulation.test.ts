import { describe, expect, it } from 'vitest'
import type { BranchableMessage } from './branch-resolver'
import {
  resolveCanonicalBranch,
  resolveRegenerationAnchor,
} from './branch-resolver'

type SimMessage = BranchableMessage & {
  readonly content: string
  regenSourceMessageId?: string
  branchAnchorMessageId?: string
}

type SimState = {
  messages: SimMessage[]
  activeChildByParent: Record<string, string>
  nextId: number
}

function createState(): SimState {
  return {
    messages: [],
    activeChildByParent: {},
    nextId: 1,
  }
}

function nextMessageId(state: SimState, prefix: 'u' | 'a'): string {
  const id = `${prefix}${state.nextId}`
  state.nextId += 1
  return id
}

function canonicalIds(state: SimState): string[] {
  return [...resolveCanonicalBranch(state.messages, state.activeChildByParent).canonicalMessageIds]
}

function canonicalLeaf(state: SimState): SimMessage | undefined {
  const resolution = resolveCanonicalBranch(state.messages, state.activeChildByParent)
  const leafId = resolution.canonicalMessageIds.at(-1)
  if (!leafId) return undefined
  return state.messages.find((message) => message.messageId === leafId)
}

function siblingsForParent(state: SimState, parentMessageId: string): SimMessage[] {
  return state.messages
    .filter((message) => message.parentMessageId === parentMessageId)
    .toSorted((left, right) => {
      const leftBranch = left.branchIndex
      const rightBranch = right.branchIndex
      if (leftBranch !== rightBranch) return leftBranch - rightBranch
      return left.messageId.localeCompare(right.messageId)
    })
}

function appendUser(state: SimState, content: string): string {
  const leaf = canonicalLeaf(state)
  const parentMessageId = leaf?.messageId
  const branchIndex =
    parentMessageId == null ? 1 : siblingsForParent(state, parentMessageId).length + 1
  const messageId = nextMessageId(state, 'u')
  state.messages.push({
    messageId,
    role: 'user',
    content,
    parentMessageId,
    branchIndex,
    createdAt: state.nextId,
  })
  if (parentMessageId) {
    state.activeChildByParent[parentMessageId] = messageId
  }
  return messageId
}

function appendAssistantForUser(state: SimState, parentUserMessageId: string, content: string): string {
  const branchIndex = siblingsForParent(state, parentUserMessageId).length + 1
  const messageId = nextMessageId(state, 'a')
  state.messages.push({
    messageId,
    role: 'assistant',
    content,
    parentMessageId: parentUserMessageId,
    branchIndex,
    branchAnchorMessageId: parentUserMessageId,
    createdAt: state.nextId,
  })
  state.activeChildByParent[parentUserMessageId] = messageId
  return messageId
}

function regenerate(state: SimState, targetMessageId: string, content: string): string {
  const anchor = resolveRegenerationAnchor(state.messages, targetMessageId)
  if (!anchor) {
    throw new Error(`Cannot regenerate target: ${targetMessageId}`)
  }

  // Mimics backend prepareRegeneration behavior: truncate canonical path at anchor
  // until the replacement assistant is finalized.
  delete state.activeChildByParent[anchor.anchorMessageId]

  const regenerated = appendAssistantForUser(state, anchor.anchorMessageId, content)
  const message = state.messages.find((entry) => entry.messageId === regenerated)
  if (!message) throw new Error('regenerated message missing')
  message.regenSourceMessageId = targetMessageId
  return regenerated
}

function selectBranch(state: SimState, parentMessageId: string, childMessageId: string): void {
  const candidate = state.messages.find(
    (message) =>
      message.messageId === childMessageId &&
      message.parentMessageId === parentMessageId,
  )
  if (!candidate) {
    throw new Error(`Invalid branch selection ${parentMessageId} -> ${childMessageId}`)
  }
  state.activeChildByParent[parentMessageId] = childMessageId
}

function assertCanonical(state: SimState, expected: string[]): void {
  expect(canonicalIds(state)).toEqual(expected)
}

describe('branch conversation simulation', () => {
  it('handles realistic branch navigation + regenerate + send without cross-branch leakage', () => {
    const state = createState()

    // Initial linear conversation
    const u1 = appendUser(state, 'start')
    const a1 = appendAssistantForUser(state, u1, 'a1')
    const u2 = appendUser(state, 'question b')
    const a2v1 = appendAssistantForUser(state, u2, 'b-v1')
    const u3v1 = appendUser(state, 'follow-up c in v1')
    const a3v1 = appendAssistantForUser(state, u3v1, 'c-v1')
    assertCanonical(state, [u1, a1, u2, a2v1, u3v1, a3v1])

    // Regenerate assistant at message "b", then continue conversation in v2
    const a2v2 = regenerate(state, a2v1, 'b-v2')
    assertCanonical(state, [u1, a1, u2, a2v2])
    const u3v2 = appendUser(state, 'follow-up c in v2')
    const a3v2 = appendAssistantForUser(state, u3v2, 'c-v2')
    assertCanonical(state, [u1, a1, u2, a2v2, u3v2, a3v2])

    // Navigate back to older branch version and ensure old descendants are intact.
    selectBranch(state, u2, a2v1)
    assertCanonical(state, [u1, a1, u2, a2v1, u3v1, a3v1])

    // Navigate forward again and ensure v2 descendants are still isolated.
    selectBranch(state, u2, a2v2)
    assertCanonical(state, [u1, a1, u2, a2v2, u3v2, a3v2])

    // Regenerate from user message "b" creating v3 path.
    const a2v3 = regenerate(state, u2, 'b-v3')
    assertCanonical(state, [u1, a1, u2, a2v3])
    const u3v3 = appendUser(state, 'follow-up c in v3')
    const a3v3 = appendAssistantForUser(state, u3v3, 'c-v3')
    assertCanonical(state, [u1, a1, u2, a2v3, u3v3, a3v3])

    // Cross-branch navigation should always restore each branch's own descendants.
    selectBranch(state, u2, a2v1)
    assertCanonical(state, [u1, a1, u2, a2v1, u3v1, a3v1])
    selectBranch(state, u2, a2v2)
    assertCanonical(state, [u1, a1, u2, a2v2, u3v2, a3v2])
    selectBranch(state, u2, a2v3)
    assertCanonical(state, [u1, a1, u2, a2v3, u3v3, a3v3])
  })

  it('keeps nested branch selections scoped under their selected parent branch', () => {
    const state = createState()

    const u1 = appendUser(state, 'root')
    const a1 = appendAssistantForUser(state, u1, 'root-a1')
    const u2 = appendUser(state, 'fork here')
    const a2v1 = appendAssistantForUser(state, u2, 'branch-1')
    const a2v2 = regenerate(state, a2v1, 'branch-2')
    const u3v2 = appendUser(state, 'nested area')
    const a3v2 = appendAssistantForUser(state, u3v2, 'nested-2-v1')
    const a3v2b = regenerate(state, a3v2, 'nested-2-v2')
    assertCanonical(state, [u1, a1, u2, a2v2, u3v2, a3v2b])

    // Set nested selection while parent branch is selected.
    selectBranch(state, u3v2, a3v2)
    assertCanonical(state, [u1, a1, u2, a2v2, u3v2, a3v2])

    // Switch parent branch away; nested branch under v2 should not leak into v1.
    selectBranch(state, u2, a2v1)
    assertCanonical(state, [u1, a1, u2, a2v1])

    // Return to parent v2 and previously selected nested branch should reappear.
    selectBranch(state, u2, a2v2)
    assertCanonical(state, [u1, a1, u2, a2v2, u3v2, a3v2])

    // Switch nested branch again and verify deterministic update.
    selectBranch(state, u3v2, a3v2b)
    assertCanonical(state, [u1, a1, u2, a2v2, u3v2, a3v2b])
  })
})
