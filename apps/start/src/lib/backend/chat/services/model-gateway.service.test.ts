import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelGatewayService } from './model-gateway.service'

const streamTextMock = vi.hoisted(() => vi.fn())

vi.mock('ai', () => ({
  convertToModelMessages: vi.fn(async () => []),
  smoothStream: vi.fn(),
  streamText: streamTextMock,
}))

beforeEach(() => {
  streamTextMock.mockReset().mockReturnValue({})
})

describe('model gateway canonical routing', () => {
  it.each([
    ['xai/grok-4.3', 'spacexai/grok-4.3'],
    ['spacexai/grok-4.7', 'spacexai/grok-4.7'],
    ['openai/gpt-6.1-sol', 'openai/gpt-6.1-sol'],
  ])('routes saved catalog ID %s to %s', async (catalogId, gatewayId) => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const gateway = yield* ModelGatewayService
        yield* gateway.streamResponse({
          model: catalogId,
          messages: [
            {
              id: 'message-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
          ],
          requestId: 'canonical-route-test',
          tools: {},
        })
      }).pipe(Effect.provide(ModelGatewayService.layer)),
    )
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: gatewayId }),
    )
  })
})
