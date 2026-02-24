import { xai } from '@ai-sdk/xai'
import type { ProviderToolRegistry } from './types'

function readXaiFileSearchVectorStoreIds(): string[] {
  const raw = process.env.XAI_FILE_SEARCH_VECTOR_STORE_IDS
  if (!raw) return []

  return raw.split(',')
}

/**
 * xAI tool builders.
 * Tools requiring per-environment config (file search / MCP) are only enabled
 * when their required env variables are present.
 */
export const XAI_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'xai'> = {
  byId: {
    web_search: () => xai.tools.webSearch(),
    x_search: () => xai.tools.xSearch(),
    code_execution: () => xai.tools.codeExecution(),
    view_image: () => xai.tools.viewImage(),
    view_x_video: () => xai.tools.viewXVideo(),
    file_search: () => {
      const vectorStoreIds = readXaiFileSearchVectorStoreIds()
      if (vectorStoreIds.length === 0) return undefined

      return xai.tools.fileSearch({
        vectorStoreIds,
      })
    },
    mcp_server: () => {
      const serverUrl = process.env.XAI_MCP_SERVER_URL
      if (!serverUrl) return undefined

      const serverLabel = process.env.XAI_MCP_SERVER_LABEL || 'default-mcp'
      return xai.tools.mcpServer({
        serverUrl,
        serverLabel,
      })
    },
  },
}
