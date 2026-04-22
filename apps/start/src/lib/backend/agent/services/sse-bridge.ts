import { Layer, ServiceMap } from 'effect'
import type { AgentLiveEvent } from '@/lib/shared/agent'
import { serializeAgentLiveEvent } from '@/lib/shared/agent'

export type AgentSseBridgeShape = {
  readonly createStream: () => {
    readonly stream: ReadableStream<Uint8Array>
    readonly emit: (event: AgentLiveEvent) => void
    readonly close: () => void
    readonly fail: (error: unknown) => void
  }
}

export class AgentSseBridge extends ServiceMap.Service<
  AgentSseBridge,
  AgentSseBridgeShape
>()('agent/AgentSseBridge') {
  static readonly layer = Layer.succeed(this, {
    createStream() {
      let controller: ReadableStreamDefaultController<Uint8Array> | null = null

      const stream = new ReadableStream<Uint8Array>({
        start(nextController) {
          controller = nextController
        },
        cancel() {
          controller = null
        },
      })

      return {
        stream,
        emit(event: AgentLiveEvent) {
          controller?.enqueue(serializeAgentLiveEvent(event))
        },
        close() {
          try {
            controller?.close()
          } finally {
            controller = null
          }
        },
        fail(error: unknown) {
          try {
            controller?.error(error)
          } finally {
            controller = null
          }
        },
      }
    },
  })
}
