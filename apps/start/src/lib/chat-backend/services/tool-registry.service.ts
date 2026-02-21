import { Context, Effect, Layer } from 'effect'

// Tool registry returns model + enabled tools for a given thread/user.
export type ToolRegistryResult = {
  readonly model: string
  readonly tools: Record<string, never>
}

export type ToolRegistryServiceShape = {
  readonly resolveForThread: (input: {
    readonly threadId: string
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<ToolRegistryResult>
}

export class ToolRegistryService extends Context.Tag('chat-backend/ToolRegistryService')<
  ToolRegistryService,
  ToolRegistryServiceShape
>() {}

export const ToolRegistryMemory = Layer.succeed(ToolRegistryService, {
  resolveForThread: () =>
    Effect.succeed({
      model: 'gpt-4o-mini',
      tools: {},
    }),
})
