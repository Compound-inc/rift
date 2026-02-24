import type { ProviderToolDefinition } from './types'

export const XAI_PROVIDER_TOOLS = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Searches the public web with citations.',
    advanced: false,
  },
  {
    id: 'x_search',
    name: 'X Search',
    description: 'Searches posts and threads on X.',
    advanced: false,
  },
  {
    id: 'code_execution',
    name: 'Code Execution',
    description: 'Executes Python code in a sandbox.',
    advanced: true,
  },
  {
    id: 'view_image',
    name: 'View Image',
    description: 'Views and analyzes images as a tool step.',
    advanced: true,
  },
  {
    id: 'view_x_video',
    name: 'View X Video',
    description: 'Views and analyzes videos linked from X.',
    advanced: true,
  },
  {
    id: 'file_search',
    name: 'File Search',
    description: 'Searches xAI vector stores (collections).',
    advanced: true,
  },
  {
    id: 'mcp_server',
    name: 'MCP Server',
    description: 'Connects to remote MCP servers.',
    advanced: true,
  },
] as const satisfies readonly ProviderToolDefinition[]

export type XaiProviderToolId = (typeof XAI_PROVIDER_TOOLS)[number]['id']
