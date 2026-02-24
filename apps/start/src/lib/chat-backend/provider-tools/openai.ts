import { openai } from '@ai-sdk/openai'
import type { ProviderToolRegistry } from './types'

function readOpenAiFileSearchVectorStoreIds(): string[] {
  const raw = process.env.OPENAI_FILE_SEARCH_VECTOR_STORE_IDS
  if (!raw) return []

  return raw.split(',')
}

/**
 * OpenAI provider-executed tool factories.
 * Keep this file provider-local so new OpenAI tools can be added without
 * touching chat orchestration or shared registry services.
 */
export const OPENAI_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'openai'> = {
  byId: {
    web_search: () =>
      openai.tools.webSearch({
        externalWebAccess: true,
      }),
    code_interpreter: () => openai.tools.codeInterpreter(),
    file_search: () => {
      const vectorStoreIds = readOpenAiFileSearchVectorStoreIds()
      if (vectorStoreIds.length === 0) return undefined
      return openai.tools.fileSearch({ vectorStoreIds })
    },
  },
}
