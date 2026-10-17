import { describe, expect, it } from 'vitest'
import { activateShare, buildSharedMessages, canReadShare } from './share'
import type { ShareMessageSource } from './share'

const active = {
  shareId: 'token',
  shareStatus: 'active' as const,
  ownerOrgId: 'org',
}
const anonymous = { isAnonymous: true, isMember: false }

describe('share authorization', () => {
  it('allows public links, including signed-out and anonymous visitors', () => {
    expect(canReadShare(active, { isAnonymous: false, isMember: false })).toBe(
      true,
    )
    expect(canReadShare(active, anonymous)).toBe(true)
  })
  it.each([
    null,
    { ...active, shareStatus: 'revoked' as const },
    { ...active, shareId: null },
  ])('hides missing and revoked shares', (thread) => {
    expect(
      canReadShare(thread, {
        userId: 'owner',
        isAnonymous: false,
        isMember: true,
      }),
    ).toBe(false)
  })
  it('requires a signed-in member of the owning organization for org-only links', () => {
    const thread = { ...active, orgOnly: true }
    expect(
      canReadShare(thread, {
        userId: 'member',
        isAnonymous: false,
        isMember: true,
      }),
    ).toBe(true)
    expect(
      canReadShare(thread, {
        userId: 'outsider',
        isAnonymous: false,
        isMember: false,
      }),
    ).toBe(false)
    expect(
      canReadShare(thread, { ...anonymous, userId: 'guest', isMember: true }),
    ).toBe(false)
    expect(canReadShare(thread, { isAnonymous: false, isMember: true })).toBe(
      false,
    )
    expect(
      canReadShare(
        { ...thread, ownerOrgId: null },
        { userId: 'owner', isAnonymous: false, isMember: true },
      ),
    ).toBe(false)
  })
})

describe('share id lifecycle', () => {
  it('creates once, preserves active ids on edits, and rotates on re-share', () => {
    const first = activateShare({}, 100, () => 'first')
    expect(first).toMatchObject({
      shareId: 'first',
      sharedAt: 100,
      shareStatus: 'active',
      allowAttachments: false,
    })
    expect(activateShare(first, 200, () => 'unused')).toEqual(first)
    const revoked = { ...first, shareStatus: 'revoked' as const }
    expect(canReadShare(revoked, anonymous)).toBe(false)
    expect(activateShare(revoked, 300, () => 'second')).toMatchObject({
      shareId: 'second',
      sharedAt: 300,
      shareStatus: 'active',
    })
  })
})

function message(
  messageId: string,
  parentMessageId?: string,
  extra: Partial<ShareMessageSource> = {},
): ShareMessageSource {
  return {
    messageId,
    parentMessageId,
    branchIndex: 0,
    role: 'assistant',
    content: messageId,
    status: 'done',
    ...extra,
  }
}
describe('live shared snapshot', () => {
  it('publishes the selected branch and only explicit public fields', () => {
    const privateMessage = {
      ...message('chosen', 'root'),
      reasoning: 'secret',
      serverError: { message: 'secret' },
      sources: [{ url: 'private-file' }],
      providerMetadata: { secret: true },
    }
    expect(
      buildSharedMessages(
        [
          message('root', undefined, {
            role: 'user',
            attachmentsIds: ['file', 'deleted'],
          }),
          message('other', 'root', { branchIndex: 1 }),
          privateMessage,
        ],
        { root: 'chosen' },
        [
          { id: 'file', fileName: 'report.pdf', status: 'uploaded' },
          { id: 'deleted', fileName: 'secret.pdf', status: 'deleted' },
        ],
      ),
    ).toEqual([
      {
        id: 'root',
        role: 'user',
        text: 'root',
        attachmentNames: ['report.pdf'],
      },
      { id: 'chosen', role: 'assistant', text: 'chosen', attachmentNames: [] },
    ])
  })
  it('does not resurrect deleted messages as roots or select a different branch', () => {
    expect(
      buildSharedMessages(
        [
          message('root', undefined, { role: 'user', status: 'deleted' }),
          message('hidden', 'root', { branchIndex: 1 }),
          message('selected', 'root'),
          message('error', 'selected', {
            status: 'error',
            content: 'private error',
          }),
        ],
        { root: 'selected', selected: 'error' },
        [],
      ).map((row) => row.id),
    ).toEqual(['selected'])
  })
  it('excludes system, streaming, cancelled and error content', () => {
    const rows = [
      message('system', undefined, { role: 'system' }),
      message('stream', 'system', { status: 'streaming' }),
      message('cancel', 'stream', { status: 'cancelled' }),
      message('error', 'cancel', { status: 'error' }),
    ]
    expect(
      buildSharedMessages(
        rows,
        { system: 'stream', stream: 'cancel', cancel: 'error' },
        [],
      ),
    ).toEqual([])
  })
})
