import { describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import { Effect } from 'effect'
import type {
  BuildTurnContextInput,
  TurnContext,
} from '@/lib/backend/rag'
import type { OrgAiPolicy } from '@/lib/shared/model-policy/types'
import { makeLoadThreadMessagesOperation } from './load-thread-messages'

/**
 * The document context itself is built by `RagContextService` (tested in
 * `rag/`). These tests cover what the message loader owns: which attachments
 * it hands to the service, which query signals it passes, and where the
 * returned blocks land in the prompt.
 */

type Run = ReturnType<typeof vi.fn>

function makeOperation(input: {
  readonly run: Run
  readonly context?: TurnContext
}) {
  const buildTurnContext = vi.fn((_: BuildTurnContextInput) =>
    Effect.succeed(input.context ?? { libraryBlock: '', turnBlock: '' }),
  )
  const loadThreadMessages = makeLoadThreadMessagesOperation({
    zeroDatabase: {
      getOrFail: Effect.succeed({ run: input.run } as never),
      withDatabase: (withDatabaseRun: (db: { run: Run }) => unknown) =>
        withDatabaseRun({ run: input.run } as never),
    } as never,
    ragContext: { buildTurnContext },
  })
  return { loadThreadMessages, buildTurnContext }
}

function textOf(message: UIMessage | undefined): string {
  return (message?.parts ?? [])
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('\n')
}

function attachmentRow(input: {
  readonly id: string
  readonly fileName: string
  readonly mimeType?: string
  readonly messageId?: string | null
  readonly userId?: string
  readonly status?: 'deleted' | 'uploaded'
  readonly createdAt?: number
}) {
  return {
    id: input.id,
    messageId: input.messageId ?? null,
    threadId: input.messageId ? 'thread-1' : null,
    userId: input.userId ?? 'user-1',
    fileKey: input.fileName,
    attachmentUrl: `https://example.com/${input.fileName}`,
    fileName: input.fileName,
    mimeType: input.mimeType ?? 'text/plain',
    fileSize: 10,
    status: input.status,
    createdAt: input.createdAt ?? 1,
    updatedAt: input.createdAt ?? 1,
  }
}

function userRow(input: {
  readonly messageId: string
  readonly content: string
  readonly parentMessageId?: string | null
  readonly branchIndex?: number
  readonly createdAt?: number
  readonly attachmentsIds?: readonly string[]
}) {
  return {
    messageId: input.messageId,
    role: 'user',
    parentMessageId: input.parentMessageId ?? null,
    branchIndex: input.branchIndex ?? 0,
    created_at: input.createdAt ?? 1,
    content: input.content,
    userId: 'user-1',
    attachmentsIds: input.attachmentsIds ?? [],
  }
}

function assistantRow(input: {
  readonly messageId: string
  readonly content: string
  readonly parentMessageId: string
  readonly createdAt: number
}) {
  return {
    ...userRow({ ...input, branchIndex: 1 }),
    role: 'assistant',
    model: 'openai/gpt-5-mini',
  }
}

function orgPolicy(orgKnowledgeEnabled: boolean): OrgAiPolicy {
  return {
    organizationId: 'org-1',
    disabledProviderIds: [],
    disabledModelIds: [],
    complianceFlags: {},
    toolPolicy: {
      providerNativeToolsEnabled: true,
      externalToolsEnabled: true,
      disabledToolKeys: [],
    },
    orgKnowledgeEnabled,
    providerKeyStatus: {
      syncedAt: 0,
      hasAnyProviderKey: false,
      providers: { openai: false, anthropic: false },
    },
    updatedAt: Date.now(),
  } as OrgAiPolicy
}

describe('makeLoadThreadMessagesOperation', () => {
  it.each([
    [true, 'org-1'],
    [false, undefined],
  ])(
    'passes the organization to RAG only when org knowledge is enabled (%s)',
    async (enabled, expectedOrganizationId) => {
      const run = vi
        .fn()
        .mockResolvedValueOnce([
          userRow({ messageId: 'user-1', content: 'How does this work?' }),
        ])
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([])
      const { loadThreadMessages, buildTurnContext } = makeOperation({ run })

      await Effect.runPromise(
        loadThreadMessages({
          threadId: 'thread-1',
          model: 'openai/gpt-5-mini',
          organizationId: 'org-1',
          orgPolicy: orgPolicy(enabled),
          requestId: 'req-org',
        }),
      )

      expect(buildTurnContext).toHaveBeenCalledOnce()
      expect(buildTurnContext.mock.calls[0][0].organizationId).toBe(
        expectedOrganizationId,
      )
    },
  )

  it('limits conversation attachments to the canonical branch', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([
        userRow({
          messageId: 'user-root',
          content: 'Initial question',
          attachmentsIds: ['att-root'],
        }),
        assistantRow({
          messageId: 'assistant-root',
          content: 'Initial answer',
          parentMessageId: 'user-root',
          createdAt: 2,
        }),
        userRow({
          messageId: 'user-canonical',
          content: 'Use the canonical file',
          parentMessageId: 'assistant-root',
          branchIndex: 1,
          createdAt: 3,
          attachmentsIds: ['att-canonical'],
        }),
        userRow({
          messageId: 'user-branch',
          content: 'Use the alternate file',
          parentMessageId: 'assistant-root',
          branchIndex: 2,
          createdAt: 4,
          attachmentsIds: ['att-branch'],
        }),
      ])
      .mockResolvedValueOnce({
        activeChildByParent: {
          'user-root': 'assistant-root',
          'assistant-root': 'user-canonical',
        },
      })
      .mockResolvedValueOnce([
        attachmentRow({ id: 'att-root', fileName: 'root.txt', messageId: 'user-root' }),
        attachmentRow({
          id: 'att-canonical',
          fileName: 'canonical.txt',
          messageId: 'user-canonical',
        }),
        attachmentRow({ id: 'att-branch', fileName: 'branch.txt', messageId: 'user-branch' }),
      ])
    const { loadThreadMessages, buildTurnContext } = makeOperation({ run })

    await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        requestId: 'req-canonical',
      }),
    )

    const call = buildTurnContext.mock.calls[0][0]
    expect(call.attachmentIds).toEqual(['att-root', 'att-canonical'])
    expect(call.query.latestUserText).toBe('Use the canonical file')
    expect(call.query.previousUserText).toBe('Initial question')
  })

  it('keeps the original files in context after a message is edited', async () => {
    // The edited copy (`user-edited`) lives on the canonical branch; the file
    // is still linked to the original message via `attachments.message_id`.
    const run = vi
      .fn()
      .mockResolvedValueOnce([
        userRow({
          messageId: 'user-original',
          content: 'Summarize the report',
          attachmentsIds: ['att-report'],
        }),
        userRow({
          messageId: 'user-edited',
          content: 'Summarize the report in Spanish',
          branchIndex: 1,
          createdAt: 2,
          attachmentsIds: ['att-report'],
        }),
      ])
      .mockResolvedValueOnce({
        activeChildByParent: { __root__: 'user-edited' },
      })
      .mockResolvedValueOnce([
        attachmentRow({
          id: 'att-report',
          fileName: 'report.pdf',
          mimeType: 'application/pdf',
          messageId: 'user-original',
        }),
      ])
    const { loadThreadMessages, buildTurnContext } = makeOperation({ run })

    const messages = await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        requestId: 'req-edit',
      }),
    )

    expect(messages.map((message) => message.id)).toEqual(['user-edited'])
    expect(buildTurnContext.mock.calls[0][0].attachmentIds).toEqual(['att-report'])
    expect(messages[0]?.metadata).toMatchObject({
      attachments: [{ id: 'att-report', name: 'report.pdf' }],
    })
  })

  it('includes pending attachments and skips deleted or foreign files', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        attachmentRow({
          id: 'att-deleted',
          fileName: 'deleted.txt',
          messageId: 'old-user',
          status: 'deleted',
        }),
        attachmentRow({
          id: 'att-foreign',
          fileName: 'foreign.txt',
          messageId: 'foreign-user-message',
          userId: 'user-2',
        }),
      ])
      .mockResolvedValueOnce([
        attachmentRow({ id: 'att-pending', fileName: 'pending.txt' }),
      ])
    const { loadThreadMessages, buildTurnContext } = makeOperation({
      run,
      context: { libraryBlock: '<documents>pending</documents>', turnBlock: '' },
    })

    const messages = await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        userId: 'user-1',
        pendingUserMessage: {
          id: 'user-pending',
          role: 'user',
          parts: [{ type: 'text', text: 'Summarize this file' }],
        },
        pendingAttachments: [{ id: 'att-pending' }],
        requestId: 'req-pending',
      }),
    )

    const call = buildTurnContext.mock.calls[0][0]
    expect(call.attachmentIds).toEqual(['att-pending'])
    expect(call.userId).toBe('user-1')
    expect(call.query.fileNames).toEqual(['pending.txt'])

    const pending = messages.at(-1)
    expect(textOf(pending)).toBe(
      '<documents>pending</documents>\n\nSummarize this file',
    )
    expect(pending?.metadata).toMatchObject({
      attachments: [{ id: 'att-pending', name: 'pending.txt' }],
    })
  })

  it('passes the project and its custom instruction for project threads', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([
        userRow({
          messageId: 'user-1',
          content: 'What should the launch brief mention?',
        }),
      ])
      .mockResolvedValueOnce({ projectId: 'project-1', activeChildByParent: {} })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'project-1',
        customInstruction: 'Act as a project planner.',
      })
    const { loadThreadMessages, buildTurnContext } = makeOperation({ run })

    await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        userId: 'user-1',
        requestId: 'req-project',
      }),
    )

    const call = buildTurnContext.mock.calls[0][0]
    expect(call.projectId).toBe('project-1')
    expect(call.query.customInstruction).toBe('Act as a project planner.')
  })

  it('sends images the model supports as native file parts, not RAG sources', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        attachmentRow({
          id: 'att-image',
          fileName: 'diagram.png',
          mimeType: 'image/png',
        }),
      ])
    const { loadThreadMessages, buildTurnContext } = makeOperation({ run })

    const messages = await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        userId: 'user-1',
        pendingUserMessage: {
          id: 'user-image',
          role: 'user',
          parts: [{ type: 'text', text: 'Describe this image' }],
        },
        pendingAttachments: [{ id: 'att-image' }],
        requestId: 'req-image',
      }),
    )

    expect(buildTurnContext.mock.calls[0][0].attachmentIds).toEqual([])
    expect(messages.at(-1)?.parts).toContainEqual({
      type: 'file',
      mediaType: 'image/png',
      filename: 'diagram.png',
      url: 'https://example.com/diagram.png',
    })
  })

  it('routes PDFs through RAG even when the model reads PDFs natively', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        attachmentRow({
          id: 'att-pdf',
          fileName: 'whitepaper.pdf',
          mimeType: 'application/pdf',
        }),
      ])
    const { loadThreadMessages, buildTurnContext } = makeOperation({ run })

    const messages = await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        userId: 'user-1',
        pendingUserMessage: {
          id: 'user-pdf',
          role: 'user',
          parts: [{ type: 'text', text: 'Summarize the whitepaper' }],
        },
        pendingAttachments: [{ id: 'att-pdf' }],
        requestId: 'req-pdf',
      }),
    )

    expect(buildTurnContext.mock.calls[0][0].attachmentIds).toEqual(['att-pdf'])
    expect(messages.at(-1)?.parts.filter((part) => part.type === 'file')).toEqual(
      [],
    )
  })

  it('expands skill slash tokens before building the retrieval query', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([
        userRow({
          messageId: 'user-1',
          content: '/refactor make the rate limiter faster',
        }),
      ])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'skill-personal',
          userId: 'user-1',
          organizationId: null,
          projectId: null,
          name: 'refactor',
          body: 'Refactor the target code to maximise readability and remove duplication.',
          deletedAt: null,
        },
      ])
    const { loadThreadMessages, buildTurnContext } = makeOperation({ run })

    const messages = await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        userId: 'user-1',
        requestId: 'req-skill',
      }),
    )

    const queryText = buildTurnContext.mock.calls[0][0].query.latestUserText
    expect(queryText).toContain('Refactor the target code to maximise readability')
    expect(queryText).toContain('make the rate limiter faster')
    expect(textOf(messages.at(-1))).not.toMatch(/(^|\s)\/refactor(\s|$)/)
  })

  it('puts full-text documents on the first user message and excerpts on the latest', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([
        userRow({ messageId: 'user-1', content: 'First question' }),
        assistantRow({
          messageId: 'assistant-1',
          content: 'First answer',
          parentMessageId: 'user-1',
          createdAt: 2,
        }),
        userRow({
          messageId: 'user-2',
          content: 'Follow-up question',
          parentMessageId: 'assistant-1',
          branchIndex: 1,
          createdAt: 3,
        }),
      ])
      .mockResolvedValueOnce({
        activeChildByParent: {
          'user-1': 'assistant-1',
          'assistant-1': 'user-2',
        },
      })
      .mockResolvedValueOnce([])
    const { loadThreadMessages, buildTurnContext } = makeOperation({
      run,
      context: {
        libraryBlock: '<documents>library</documents>',
        turnBlock: '<retrieved_context>excerpts</retrieved_context>',
      },
    })

    const messages = await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        contextWindowTokens: 50_000,
        requestId: 'req-placement',
      }),
    )

    expect(buildTurnContext.mock.calls[0][0].contextWindowTokens).toBe(50_000)
    expect(textOf(messages[0])).toBe(
      '<documents>library</documents>\n\nFirst question',
    )
    expect(textOf(messages[1])).toBe('First answer')
    expect(textOf(messages[2])).toBe(
      '<retrieved_context>excerpts</retrieved_context>\n\nFollow-up question',
    )
  })
})

it('previews edited text with retained files and RAG before creating a branch', async () => {
  const original = userRow({ messageId: 'original', content: 'Old question', attachmentsIds: ['file'] })
  const run = vi.fn()
    .mockResolvedValueOnce([original, assistantRow({ messageId: 'answer', content: 'Old answer', parentMessageId: 'original', createdAt: 2 })])
    .mockResolvedValueOnce({ activeChildByParent: { original: 'answer' } })
    .mockResolvedValueOnce([attachmentRow({ id: 'file', fileName: 'retained.txt', messageId: 'original' })])
  const { loadThreadMessages, buildTurnContext } = makeOperation({ run, context: { libraryBlock: 'Document context', turnBlock: '' } })
  const messages = await Effect.runPromise(loadThreadMessages({
    threadId: 'thread-1', userId: 'user-1', model: 'openai/gpt-5-mini', requestId: 'preview',
    branchTurn: { targetMessageId: 'original', editedText: '  New question  ' },
  }))
  expect(messages.map((message) => message.id)).toEqual(['original'])
  expect(textOf(messages[0])).toBe('Document context\n\nNew question')
  expect(buildTurnContext.mock.calls[0][0].query.latestUserText).toBe('New question')
  expect(buildTurnContext.mock.calls[0][0].attachmentIds).toEqual(['file'])
  expect(original.content).toBe('Old question')
})

it('previews regeneration through its user anchor and excludes the old answer', async () => {
  const run = vi.fn()
    .mockResolvedValueOnce([userRow({ messageId: 'original', content: 'Question' }), assistantRow({ messageId: 'answer', content: 'Old answer', parentMessageId: 'original', createdAt: 2 })])
    .mockResolvedValueOnce({ activeChildByParent: { original: 'answer' } })
    .mockResolvedValueOnce([])
  const { loadThreadMessages } = makeOperation({ run })
  const messages = await Effect.runPromise(loadThreadMessages({
    threadId: 'thread-1', userId: 'user-1', model: 'openai/gpt-5-mini', requestId: 'preview',
    branchTurn: { targetMessageId: 'answer' },
  }))
  expect(messages.map((message) => message.id)).toEqual(['original'])
})
