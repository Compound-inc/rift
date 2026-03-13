import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { ChatOrchestratorService } from '@/lib/backend/chat/services/chat-orchestrator.service'
import { MessageStoreService } from '@/lib/backend/chat/services/message-store.service'
import { ChatRuntime } from './chat-runtime'

/**
 * These runtime-resolution tests guard the production layer graph.
 * The chat runtime failed earlier because a newly introduced backend service
 * was not actually reachable from the assembled runtime, even though unit
 * tests using memory layers still passed.
 */
describe('ChatRuntime', () => {
  it('resolves the message store from the production runtime graph', async () => {
    const result = await ChatRuntime.run(
      Effect.gen(function* () {
        const messageStore = yield* MessageStoreService
        return typeof messageStore.loadThreadMessages
      }),
    )

    expect(result).toBe('function')
  })

  it('resolves the chat orchestrator from the production runtime graph', async () => {
    const result = await ChatRuntime.run(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        return typeof orchestrator.streamChat
      }),
    )

    expect(result).toBe('function')
  })
})
