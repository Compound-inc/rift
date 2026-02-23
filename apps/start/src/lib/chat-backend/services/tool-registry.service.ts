import { Effect, Layer, ServiceMap } from 'effect'

// Tool registry returns enabled tools for a given thread/user.
export type ToolRegistryResult = {
  readonly tools: Record<string, never>
}

export type ToolRegistryServiceShape = {
  readonly resolveForThread: (input: {
    readonly threadId: string
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<ToolRegistryResult>
}

export class ToolRegistryService extends ServiceMap.Service<
  ToolRegistryService,
  ToolRegistryServiceShape
>()('chat-backend/ToolRegistryService') {}

export const ToolRegistryLive = Layer.succeed(ToolRegistryService, {
  resolveForThread: () =>
    Effect.succeed({
      tools: {},
    }),
})

export const ToolRegistryMemory = Layer.succeed(ToolRegistryService, {
  resolveForThread: () =>
    Effect.succeed({
      tools: {},
    }),
})
