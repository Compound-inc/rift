import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { makeLoadThreadMessagesOperation } from './load-thread-messages'

describe('makeLoadThreadMessagesOperation', () => {
  it('attempts org knowledge lookup whenever org knowledge is enabled', async () => {
    const listActiveAttachmentIds = vi.fn(() =>
      Effect.succeed<readonly string[]>([]),
    )
    const run = vi
      .fn()
      .mockResolvedValueOnce([
        {
          messageId: 'user-1',
          role: 'user',
          parentMessageId: null,
          branchIndex: 0,
          created_at: Date.now(),
          content: 'How does this work?',
          userId: 'user-1',
          attachmentsIds: [],
        },
      ])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])

    const loadThreadMessages = makeLoadThreadMessagesOperation({
      zeroDatabase: {
        getOrFail: Effect.succeed({
          run,
        } as never),
        withDatabase: (withDatabaseRun: (db: { run: typeof run }) => unknown) =>
          withDatabaseRun({
            run,
          } as never),
      } as never,
      attachmentRecord: {
        listAttachmentContentRowsByThread: () => Effect.succeed([]),
      } as never,
      attachmentRag: {
        searchThreadAttachments: () => Effect.succeed([]),
      } as never,
      orgKnowledgeRag: {
        searchOrgKnowledge: () => Effect.succeed([]),
      } as never,
      orgKnowledgeRepository: {
        listActiveAttachmentIds,
      } as never,
    })

    const messages = await Effect.runPromise(
      loadThreadMessages({
        threadId: 'thread-1',
        model: 'openai/gpt-5-mini',
        organizationId: 'org-1',
        orgPolicy: {
          organizationId: 'org-1',
          disabledProviderIds: [],
          disabledModelIds: [],
          complianceFlags: {},
          toolPolicy: {
            providerNativeToolsEnabled: true,
            externalToolsEnabled: true,
            disabledToolKeys: [],
          },
          orgKnowledgeEnabled: true,
          providerKeyStatus: {
            syncedAt: 0,
            hasAnyProviderKey: false,
            providers: {
              openai: false,
              anthropic: false,
            },
          },
          updatedAt: Date.now(),
        },
        requestId: 'req-org-skip',
      }),
    )

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      id: 'user-1',
      role: 'user',
    })
    expect(listActiveAttachmentIds).toHaveBeenCalledOnce()
  })
})
