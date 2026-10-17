/**
 * PREVIEW-ONLY local model routing (never part of a PR).
 *
 * The local AI Gateway key is dead, so when RIFT_LOCAL_OPENROUTER_ROUTING=true
 * every string model id (chat, title generation, compaction) resolves through
 * OpenRouter instead of the AI SDK's default gateway provider:
 * - `openai/*` models use OpenRouter's Responses API through @ai-sdk/openai so
 *   provider-executed web_search / code_interpreter calls stream as real tool
 *   parts (tool activity rows, sources, citations).
 * - everything else uses OpenRouter chat completions with OpenRouter slugs.
 */
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { wrapLanguageModel } from 'ai'

const OPENROUTER_SLUG_PREFIXES: Record<string, string> = {
  'meta/': 'meta-llama/',
  'xai/': 'x-ai/',
  'mistral/': 'mistralai/',
  'zai/': 'z-ai/',
  'alibaba/': 'qwen/',
}

function toOpenRouterSlug(modelId: string): string {
  for (const [from, to] of Object.entries(OPENROUTER_SLUG_PREFIXES)) {
    if (modelId.startsWith(from)) return to + modelId.slice(from.length)
  }
  return modelId
}

if (
  process.env.RIFT_LOCAL_OPENROUTER_ROUTING === 'true' &&
  process.env.OPENROUTER_API_KEY?.trim()
) {
  const apiKey = process.env.OPENROUTER_API_KEY.trim()
  // OpenRouter rejects Responses `include` values it does not know (the SDK
  // adds `web_search_call.action.sources` whenever web search is active).
  const allowedIncludes = new Set([
    'file_search_call.results',
    'message.input_image.image_url',
    'computer_call_output.output.image_url',
    'reasoning.encrypted_content',
    'code_interpreter_call.outputs',
  ])
  const openaiViaOpenRouter = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    fetch: async (input, init) => {
      if (typeof init?.body === 'string') {
        const body = JSON.parse(init.body) as { include?: string[] }
        if (Array.isArray(body.include)) {
          body.include = body.include.filter((value) => allowedIncludes.has(value))
          if (body.include.length === 0) delete body.include
          init = { ...init, body: JSON.stringify(body) }
        }
      }
      return fetch(input, init)
    },
  })
  const openrouter = createOpenRouter({ apiKey })

  const languageModel = (modelId: string) => {
    if (modelId.startsWith('openai/')) {
      // OpenRouter's Responses API is stateless: never reference stored items.
      return wrapLanguageModel({
        model: openaiViaOpenRouter.responses(modelId),
        middleware: {
          specificationVersion: 'v4',
          transformParams: async ({ params }: { params: any }) => ({
            ...params,
            providerOptions: {
              ...params.providerOptions,
              // OpenRouter slugs hide reasoning models from the SDK's id sniffing.
              openai: { ...params.providerOptions?.openai, store: false, forceReasoning: true },
            },
          }),
        } as never,
      })
    }
    return openrouter.chat(toOpenRouterSlug(modelId), {
      usage: { include: true },
    })
  }

  globalThis.AI_SDK_DEFAULT_PROVIDER = {
    specificationVersion: 'v4',
    languageModel,
    embeddingModel: (modelId: string) =>
      openrouter.textEmbeddingModel(toOpenRouterSlug(modelId)),
    textEmbeddingModel: (modelId: string) =>
      openrouter.textEmbeddingModel(toOpenRouterSlug(modelId)),
    imageModel: (modelId: string) => openrouter.imageModel(modelId),
  } as never
  console.info('[preview] Routing default AI SDK provider through OpenRouter')
}

export {}
