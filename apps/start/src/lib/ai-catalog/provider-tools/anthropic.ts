import type { ProviderToolDefinition } from './types'

type AnthropicToolFamily = 'web_search' | 'web_fetch' | 'computer' | 'text_editor'

/**
 * Anthropic tool ids are versioned by suffix (typically a date-like number),
 * e.g. `web_fetch_20250910`.
 */
export type AnthropicProviderToolId = `${AnthropicToolFamily}_${number}`

/**
 * Derives UI/policy metadata for Anthropic tools from the tool family prefix,
 * so only the model catalog needs to pin exact version ids.
 */
export function getAnthropicProviderToolDefinition(
  toolId: AnthropicProviderToolId,
): ProviderToolDefinition | undefined {
  if (toolId.startsWith('web_search_')) {
    return {
      id: toolId,
      name: 'Web Search',
      description: 'Performs web search for up-to-date external information.',
      advanced: false,
    }
  }

  if (toolId.startsWith('web_fetch_')) {
    return {
      id: toolId,
      name: 'Web Fetch',
      description: 'Retrieves and summarizes remote web pages.',
      advanced: false,
    }
  }

  if (toolId.startsWith('computer_')) {
    return {
      id: toolId,
      name: 'Computer Use',
      description: 'Executes interactive computer-control actions.',
      advanced: true,
    }
  }

  if (toolId.startsWith('text_editor_')) {
    return {
      id: toolId,
      name: 'Text Editor',
      description: 'Performs structured file read/write edits.',
      advanced: true,
    }
  }

  return undefined
}
