export type AiModelTag =
  | 'collects_data'
  | 'reasoning'
  | 'multimodal'
  | 'fast'
  | 'economical'

export type AiModelCapabilities = {
  readonly supportsTools: boolean
  readonly supportsStreaming: boolean
  readonly supportsReasoning: boolean
  readonly supportsImageInput: boolean
}

export type AiModelRequirement = {
  readonly key: string
  readonly value: string | boolean | number
}

export type AiModelCatalogEntry = {
  readonly id: string
  readonly providerId: string
  readonly name: string
  readonly description: string
  readonly contextWindow: number
  readonly tags: readonly AiModelTag[]
  readonly capabilities: AiModelCapabilities
  readonly requirements?: readonly AiModelRequirement[]
}
