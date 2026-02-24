import { google } from '@ai-sdk/google'
import type { ProviderToolRegistry } from './types'

function readGoogleFileSearchStoreNames(): string[] {
  const raw = process.env.GOOGLE_FILE_SEARCH_STORE_NAMES
  if (!raw) return []
  return raw.split(',')
}

function readVertexRagCorpus(): string | undefined {
  return process.env.GOOGLE_VERTEX_RAG_CORPUS
}

/** Google provider-executed tool factories. */
export const GOOGLE_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'google'> = {
  byId: {
    google_search: () => google.tools.googleSearch({}),
    code_execution: () => google.tools.codeExecution({}),
    file_search: () => {
      const fileSearchStoreNames = readGoogleFileSearchStoreNames()
      if (fileSearchStoreNames.length === 0) return undefined
      return google.tools.fileSearch({ fileSearchStoreNames })
    },
    url_context: () => google.tools.urlContext({}),
    google_maps: () => google.tools.googleMaps({}),
    // Vertex-only tool. It can stay cataloged and will only activate on
    // compatible deployments/models where Vertex routing is in place.
    enterprise_web_search: () => google.tools.enterpriseWebSearch({}),
    // Vertex-only tool. Requires a configured ragCorpus resource name.
    vertex_rag_store: () => {
      const ragCorpus = readVertexRagCorpus()
      if (!ragCorpus) return undefined
      return google.tools.vertexRagStore({ ragCorpus })
    },
  },
}
