/**
 * Shared display names and metadata for AI providers in the model-policy UI.
 * Single source of truth for provider labels, descriptions, and official links.
 */

/** Used as invisible placeholder so provider detail page header height matches Models page. */
export const DESCRIPTION_PLACEHOLDER =
  'Manage providers and models for your organization.'

export const PROVIDER_NAMES: Record<string, string> = {
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

export type ProviderMeta = {
  description: string
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  openai: {
    description:
      'Models including GPT-4o and o1 for chat, reasoning, and tool use.',
  },
  anthropic: {
    description:
      'Claude models for long-context reasoning, coding, and analysis.',
  },
  google: {
    description: 'Gemini models for multimodal understanding and generation.',
  },
  alibaba: {
    description: 'Qwen and other models for multilingual and coding tasks.',
  },
  deepseek: {
    description: 'DeepSeek models for coding and general-purpose chat.',
  },
  meta: {
    description: 'Llama models for open-weight language and coding.',
  },
  mistral: {
    description: 'Mistral and Mixtral models for efficient inference.',
  },
  minimax: {
    description: 'MiniMax models for text and multimodal generation.',
  },
  moonshotai: {
    description: 'Moonshot models for long-context and reasoning.',
  },
  xai: {
    description: 'Grok and other xAI models for reasoning and chat.',
  },
  zai: {
    description: 'Z.AI models and APIs.',
  },
}
