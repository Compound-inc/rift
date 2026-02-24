import { anthropic } from '@ai-sdk/anthropic'
import type { ProviderToolIdByProvider } from '@/lib/ai-catalog/provider-tools'
import type { ProviderToolFactory } from './types'
import type { ProviderToolRegistry } from './types'

function getAnthropicToolFactory(
  toolId: ProviderToolIdByProvider['anthropic'],
): ProviderToolFactory | undefined {
  const tools = anthropic.tools as unknown as Record<string, (...args: any[]) => unknown>

  if (toolId.startsWith('web_search_')) {
    const version = toolId.slice('web_search_'.length)
    const fn = tools[`webSearch_${version}`]
    if (!fn) return undefined
    return () => fn({ maxUses: 3 }) as ReturnType<ProviderToolFactory>
  }

  if (toolId.startsWith('web_fetch_')) {
    const version = toolId.slice('web_fetch_'.length)
    const fn = tools[`webFetch_${version}`]
    if (!fn) return undefined
    return () => fn({ maxUses: 3 }) as ReturnType<ProviderToolFactory>
  }

  if (toolId.startsWith('text_editor_')) {
    const version = toolId.slice('text_editor_'.length)
    const fn = tools[`textEditor_${version}`]
    if (!fn) return undefined
    return () => fn({}) as ReturnType<ProviderToolFactory>
  }

  if (toolId.startsWith('computer_')) {
    const version = toolId.slice('computer_'.length)
    const fn = tools[`computer_${version}`]
    if (!fn) return undefined
    return () =>
      fn({
        displayWidthPx: 1280,
        displayHeightPx: 800,
      }) as ReturnType<ProviderToolFactory>
  }

  return undefined
}

/**
 * Anthropic provider tool factories.
 * Version resolution is inferred from catalog tool ids so models can choose
 * exact tool versions without adding duplicate backend id mappings.
 */
export const ANTHROPIC_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'anthropic'> = {
  resolve: (toolId, context) => {
    const factory = getAnthropicToolFactory(toolId)
    if (!factory) return undefined
    return factory(context)
  },
}
