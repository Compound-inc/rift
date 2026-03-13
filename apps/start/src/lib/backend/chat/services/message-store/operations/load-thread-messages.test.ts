import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { makeLoadThreadMessagesOperation } from './load-thread-messages'

describe('makeLoadThreadMessagesOperation', () => {
  it('skips org knowledge lookup when the indexed active count is zero', async () => {
    const listActiveAttachmentIds = vi.fn(() =>
      Effect.succeed<readonly string[]>(['should-not-run']),
    )

    const loadThreadMessages = makeLoadThreadMessagesOperation({
      zeroDatabase: {
        getOrFail: Effect.succeed({
          run: async () => [],
        } as never),
        withDatabase: (run) =>
          run({
            run: async () => [],
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
          activeOrgKnowledgeCount: 0,
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

    expect(messages).toEqual([])
    expect(listActiveAttachmentIds).not.toHaveBeenCalled()
  })
})
