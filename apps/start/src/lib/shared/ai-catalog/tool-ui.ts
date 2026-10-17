import { m } from '@/paraglide/messages.js'

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  alibaba: 'Alibaba',
  deepseek: 'DeepSeek',
  meta: 'Meta',
  mistral: 'Mistral',
  minimax: 'MiniMax',
  moonshotai: 'Moonshot',
  xai: 'xAI',
  zai: 'Z.AI',
}

type ToolUiCopy = {
  readonly label: string
  readonly description: string
}

/**
 * UI grouping is intentionally semantic rather than tied to exact provider
 * tool ids. Anthropic exposes multiple revisions for the same capability, and
 * settings pages should collapse only the revisions that are indistinguishable
 * to the user.
 */
export function getToolUiGroupKey(toolKey: string): string {
  switch (toolKey) {
    case 'anthropic.web_search_20250305':
      return 'anthropic.web_search'
    case 'anthropic.web_search_20260209':
      return 'anthropic.web_search.dynamic'
    case 'anthropic.web_fetch_20250910':
      return 'anthropic.web_fetch'
    case 'anthropic.web_fetch_20260209':
      return 'anthropic.web_fetch.dynamic'
    case 'anthropic.code_execution_20250825':
    case 'anthropic.code_execution_20260120':
      return 'anthropic.code_execution'
    default:
      return toolKey
  }
}

function withVariant(label: string, variant: string): string {
  return m.tool_label_with_variant({
    label,
    variant,
  })
}

/**
 * Maps canonical provider-tool keys to localized UI copy. The catalog remains
 * the source of truth for policy/runtime identifiers; this helper exists only
 * for human-facing names and descriptions.
 */
export function getLocalizedToolCopy(toolKey: string): ToolUiCopy {
  switch (toolKey) {
    case 'rift.documents':
      return { label: m.document_tools_label(), description: m.document_tools_description() }
    case 'openai.web_search':
    case 'xai.web_search':
      return {
        label: m.tool_label_web_search(),
        description: m.tool_description_web_search(),
      }
    case 'anthropic.web_search_20250305':
      return {
        label: m.tool_label_web_search(),
        description: m.tool_description_web_search(),
      }
    case 'anthropic.web_search_20260209':
      return {
        label: withVariant(
          m.tool_label_web_search(),
          m.tool_variant_dynamic_filtering(),
        ),
        description: m.tool_description_web_search_dynamic(),
      }
    case 'anthropic.web_fetch_20250910':
      return {
        label: m.tool_label_web_fetch(),
        description: m.tool_description_web_fetch(),
      }
    case 'anthropic.web_fetch_20260209':
      return {
        label: withVariant(
          m.tool_label_web_fetch(),
          m.tool_variant_dynamic_filtering(),
        ),
        description: m.tool_description_web_fetch_dynamic(),
      }
    case 'xai.x_search':
      return {
        label: m.tool_label_x_search(),
        description: m.tool_description_x_search(),
      }
    case 'openai.code_interpreter':
      return {
        label: m.tool_label_code_interpreter(),
        description: m.tool_description_code_interpreter(),
      }
    case 'google.google_search':
      return {
        label: m.tool_label_google_search(),
        description: m.tool_description_google_search(),
      }
    case 'google.url_context':
      return {
        label: m.tool_label_url_context(),
        description: m.tool_description_url_context(),
      }
    case 'google.code_execution':
    case 'anthropic.code_execution_20260120':
    case 'anthropic.code_execution_20250825':
    case 'xai.code_execution':
      return {
        label: m.tool_label_code_execution(),
        description: m.tool_description_code_execution(),
      }
    case 'xai.view_image':
      return {
        label: m.tool_label_view_image(),
        description: m.tool_description_view_image(),
      }
    case 'xai.view_x_video':
      return {
        label: m.tool_label_view_x_video(),
        description: m.tool_description_view_x_video(),
      }
    default:
      return {
        label: toolKey,
        description: toolKey,
      }
  }
}

export function getProviderDisplayName(providerId: string): string {
  return PROVIDER_DISPLAY_NAMES[providerId] ?? providerId
}

/**
 * Provider disambiguation is added only when multiple visible tools share the
 * same human-readable label. This keeps the chat menu concise while preserving
 * clarity in org-wide settings where several providers expose "Web Search".
 */
export function getToolDisplayLabel(input: {
  readonly toolKey: string
  readonly providerId: string
  readonly duplicateLabels?: ReadonlySet<string>
}): string {
  const copy = getLocalizedToolCopy(input.toolKey)
  if (!input.duplicateLabels?.has(copy.label)) {
    return copy.label
  }

  return m.tool_label_with_provider({
    label: copy.label,
    providerName: getProviderDisplayName(input.providerId),
  })
}
