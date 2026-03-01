import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { normalizeStreamCommand } from './command'

describe('normalizeStreamCommand', () => {
  it('accepts valid submit-message command', async () => {
    const command = await Effect.runPromise(
      normalizeStreamCommand({
        trigger: 'submit-message',
        expectedBranchVersion: 3,
        message: {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'hello' }],
        },
        requestId: 'req-1',
      }),
    )

    expect(command.trigger).toBe('submit-message')
    expect(command.expectedBranchVersion).toBe(3)
  })

  it('rejects regenerate-message without target messageId', async () => {
    const error = await Effect.runPromise(
      normalizeStreamCommand({
        trigger: 'regenerate-message',
        expectedBranchVersion: 1,
        requestId: 'req-2',
      }).pipe(Effect.flip),
    )

    expect(error._tag).toBe('InvalidRequestError')
    expect(error.issue).toContain('messageId is required')
  })

  it('rejects edit-message without editedText', async () => {
    const error = await Effect.runPromise(
      normalizeStreamCommand({
        trigger: 'edit-message',
        expectedBranchVersion: 1,
        messageId: 'm1',
        editedText: '   ',
        requestId: 'req-3',
      }).pipe(Effect.flip),
    )

    expect(error._tag).toBe('InvalidRequestError')
    expect(error.issue).toContain('editedText is required')
  })
})
