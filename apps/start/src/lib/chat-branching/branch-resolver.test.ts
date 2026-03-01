import { describe, expect, it } from 'vitest'
import {
  ROOT_BRANCH_PARENT_KEY,
  resolveEditableUserTarget,
  resolveCanonicalBranch,
  resolveRegenerationAnchor,
} from './branch-resolver'

type TestMessage = {
  messageId: string
  role: 'user' | 'assistant' | 'system'
  parentMessageId?: string
  branchIndex: number
  createdAt?: number
}

describe('branch-resolver', () => {
  it('resolves a linear canonical path', () => {
    const messages: TestMessage[] = [
      { messageId: 'u1', role: 'user', branchIndex: 1, createdAt: 1 },
      { messageId: 'a1', role: 'assistant', parentMessageId: 'u1', branchIndex: 1, createdAt: 2 },
      { messageId: 'u2', role: 'user', parentMessageId: 'a1', branchIndex: 1, createdAt: 3 },
      { messageId: 'a2', role: 'assistant', parentMessageId: 'u2', branchIndex: 1, createdAt: 4 },
    ]

    const resolution = resolveCanonicalBranch(messages, {
      u1: 'a1',
      a1: 'u2',
      u2: 'a2',
    })

    expect(resolution.canonicalMessageIds).toEqual(['u1', 'a1', 'u2', 'a2'])
  })

  it('chooses selected assistant branch under a user anchor', () => {
    const messages: TestMessage[] = [
      { messageId: 'u1', role: 'user', branchIndex: 1, createdAt: 1 },
      {
        messageId: 'a1-v1',
        role: 'assistant',
        parentMessageId: 'u1',
        branchIndex: 1,
        createdAt: 2,
      },
      {
        messageId: 'a1-v2',
        role: 'assistant',
        parentMessageId: 'u1',
        branchIndex: 2,
        createdAt: 3,
      },
    ]

    const resolution = resolveCanonicalBranch(messages, { u1: 'a1-v1' })

    expect(resolution.canonicalMessageIds).toEqual(['u1', 'a1-v1'])
    expect(resolution.branchOptionsByParent.u1).toEqual(['a1-v1', 'a1-v2'])
  })

  it('handles nested branch selections deterministically', () => {
    const messages: TestMessage[] = [
      { messageId: 'u1', role: 'user', branchIndex: 1, createdAt: 1 },
      { messageId: 'a1-v1', role: 'assistant', parentMessageId: 'u1', branchIndex: 1, createdAt: 2 },
      { messageId: 'a1-v2', role: 'assistant', parentMessageId: 'u1', branchIndex: 2, createdAt: 3 },
      { messageId: 'u2-v2', role: 'user', parentMessageId: 'a1-v2', branchIndex: 1, createdAt: 4 },
      { messageId: 'a2-v1', role: 'assistant', parentMessageId: 'u2-v2', branchIndex: 1, createdAt: 5 },
      { messageId: 'a2-v2', role: 'assistant', parentMessageId: 'u2-v2', branchIndex: 2, createdAt: 6 },
    ]

    const resolution = resolveCanonicalBranch(messages, {
      u1: 'a1-v2',
      'a1-v2': 'u2-v2',
      'u2-v2': 'a2-v2',
    })

    expect(resolution.canonicalMessageIds).toEqual(['u1', 'a1-v2', 'u2-v2', 'a2-v2'])
    expect(resolution.branchOptionsByParent.u1).toEqual(['a1-v1', 'a1-v2'])
    expect(resolution.branchOptionsByParent['u2-v2']).toEqual(['a2-v1', 'a2-v2'])
  })

  it('truncates canonical path when anchor child selection is removed', () => {
    const messages: TestMessage[] = [
      { messageId: 'u1', role: 'user', branchIndex: 1, createdAt: 1 },
      { messageId: 'a1', role: 'assistant', parentMessageId: 'u1', branchIndex: 1, createdAt: 2 },
      { messageId: 'u2', role: 'user', parentMessageId: 'a1', branchIndex: 1, createdAt: 3 },
      { messageId: 'a2', role: 'assistant', parentMessageId: 'u2', branchIndex: 1, createdAt: 4 },
    ]

    const full = resolveCanonicalBranch(messages, {
      u1: 'a1',
      a1: 'u2',
      u2: 'a2',
    })
    const truncated = resolveCanonicalBranch(messages, {
      a1: 'u2',
      u2: 'a2',
    })

    expect(full.canonicalMessageIds).toEqual(['u1', 'a1', 'u2', 'a2'])
    expect(truncated.canonicalMessageIds).toEqual(['u1'])
  })

  it('resolves regenerate anchor from user and assistant targets', () => {
    const messages: TestMessage[] = [
      { messageId: 'u1', role: 'user', branchIndex: 1, createdAt: 1 },
      { messageId: 'a1', role: 'assistant', parentMessageId: 'u1', branchIndex: 1, createdAt: 2 },
    ]

    const userTarget = resolveRegenerationAnchor(messages, 'u1')
    const assistantTarget = resolveRegenerationAnchor(messages, 'a1')

    expect(userTarget).toEqual({
      anchorMessageId: 'u1',
      anchorRole: 'user',
      targetMessageId: 'u1',
    })
    expect(assistantTarget).toEqual({
      anchorMessageId: 'u1',
      anchorRole: 'user',
      targetMessageId: 'a1',
    })
  })

  it('supports deterministic root branch selection', () => {
    const messages: TestMessage[] = [
      { messageId: 'u1-v1', role: 'user', branchIndex: 1, createdAt: 1 },
      { messageId: 'u1-v2', role: 'user', branchIndex: 2, createdAt: 2 },
      { messageId: 'a1-v2', role: 'assistant', parentMessageId: 'u1-v2', branchIndex: 1, createdAt: 3 },
    ]

    const defaultResolution = resolveCanonicalBranch(messages, {})
    const selectedResolution = resolveCanonicalBranch(messages, {
      [ROOT_BRANCH_PARENT_KEY]: 'u1-v2',
      'u1-v2': 'a1-v2',
    })

    expect(defaultResolution.canonicalMessageIds).toEqual(['u1-v1'])
    expect(defaultResolution.branchOptionsByParent[ROOT_BRANCH_PARENT_KEY]).toEqual([
      'u1-v1',
      'u1-v2',
    ])
    expect(selectedResolution.canonicalMessageIds).toEqual(['u1-v2', 'a1-v2'])
  })

  it('resolves editable target only for canonical user messages', () => {
    const messages: TestMessage[] = [
      { messageId: 'u1', role: 'user', branchIndex: 1, createdAt: 1 },
      { messageId: 'a1', role: 'assistant', parentMessageId: 'u1', branchIndex: 1, createdAt: 2 },
      { messageId: 'u2-v1', role: 'user', parentMessageId: 'a1', branchIndex: 1, createdAt: 3 },
      { messageId: 'u2-v2', role: 'user', parentMessageId: 'a1', branchIndex: 2, createdAt: 4 },
    ]

    const canonicalEdit = resolveEditableUserTarget(messages, {
      u1: 'a1',
      a1: 'u2-v2',
    }, 'u2-v2')
    const hiddenEdit = resolveEditableUserTarget(messages, {
      u1: 'a1',
      a1: 'u2-v2',
    }, 'u2-v1')

    expect(canonicalEdit).toEqual({
      targetMessageId: 'u2-v2',
      parentMessageId: 'a1',
      parentSelectionKey: 'a1',
      siblingUserMessageIds: ['u2-v1', 'u2-v2'],
    })
    expect(hiddenEdit).toBeNull()
  })
})
