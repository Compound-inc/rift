import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import {
  validateUpdateChatPolicySettingsAction,
} from './chat-policy-settings.service'

describe('validateUpdateChatPolicySettingsAction', () => {
  it('accepts known tool keys', async () => {
    await expect(
      Effect.runPromise(
        validateUpdateChatPolicySettingsAction({
          requestId: 'req-valid-tool',
          action: {
            action: 'toggle_tool',
            toolKey: 'openai.web_search',
            disabled: true,
          },
        }),
      ),
    ).resolves.toBeUndefined()
  })

  it('rejects unknown tool keys', async () => {
    await expect(
      Effect.runPromise(
        validateUpdateChatPolicySettingsAction({
          requestId: 'req-invalid-tool',
          action: {
            action: 'toggle_tool',
            toolKey: 'unknown.tool',
            disabled: true,
          },
        }),
      ),
    ).rejects.toMatchObject({
      _tag: 'ChatPolicyInvalidRequestError',
      message: 'Unknown tool key: unknown.tool',
    })
  })
})
