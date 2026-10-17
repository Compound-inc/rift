import { asSchema } from 'ai'
import type { ToolSet } from 'ai'
import { estimateTokensFromText } from '@/lib/shared/chat-contracts/prompt-usage'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
import type { AiContextWindowMode } from '@/lib/shared/ai-catalog/types'
import { ContextWindowExceededError } from '../../domain/errors'

const FALLBACK_OUTPUT_TOKENS = 32_768
const CHAT_OUTPUT_CEILING = 128_000
export const MIN_ANSWER_TOKENS = 4_096

/**
 * Reserve a percentage of the prompt for tokenization/framing uncertainty. The
 * Anthropic adapter adds fixed thinking to maxOutputTokens, so both must fit
 * inside the remaining context AND the provider's total output ceiling.
 */
export function resolveOutputLimits(input: {
  readonly modelId: string
  readonly estimatedPromptTokens?: number
  readonly maxOutputTokens?: number
  readonly providerOptions?: Record<string, unknown>
  readonly contextWindowTokens?: number
  readonly requestId?: string
  readonly threadId?: string
  readonly contextWindowMode?: AiContextWindowMode
}): { maxOutputTokens: number; providerOptions?: Record<string, unknown> } {
  const model = getCatalogModel(input.modelId)
  const outputLimit = Math.min(
    CHAT_OUTPUT_CEILING,
    model?.defaultMaxOutputTokens ?? FALLBACK_OUTPUT_TOKENS,
  )
  const maxContext = input.contextWindowTokens ?? model?.contextWindow
  const promptTokens = input.estimatedPromptTokens ?? 0
  const contextRoom =
    maxContext === undefined
      ? outputLimit
      : Math.floor(
          maxContext - promptTokens - Math.max(1_024, promptTokens * 0.1),
        )
  const totalRoom = Math.min(outputLimit, contextRoom, input.maxOutputTokens ?? Infinity)
  const anthropic = input.providerOptions?.anthropic as
    | Record<string, unknown>
    | undefined
  const thinking = anthropic?.thinking as Record<string, unknown> | undefined
  const enabled =
    thinking?.type === 'enabled' && typeof thinking.budgetTokens === 'number'
  // Anthropic requires at least 1024 thinking tokens. Retain that floor while
  // leaving a useful answer allowance even when a requested budget is enormous.
  const budgetTokens = enabled
    ? Math.min(
        Math.max(1_024, thinking.budgetTokens as number),
        totalRoom - MIN_ANSWER_TOKENS,
      )
    : 0
  const maxOutputTokens = totalRoom - budgetTokens
  if (
    maxOutputTokens < MIN_ANSWER_TOKENS ||
    (enabled && budgetTokens < 1_024)
  ) {
    throw new ContextWindowExceededError({
      message: 'This conversation has reached the current context limit.',
      requestId: input.requestId ?? 'output-limits',
      threadId: input.threadId ?? '',
      modelId: input.modelId,
      contextWindowMode: input.contextWindowMode ?? 'standard',
      usedTokens: promptTokens,
      maxTokens: maxContext ?? outputLimit,
    })
  }
  return {
    maxOutputTokens,
    providerOptions: enabled
      ? {
          ...input.providerOptions,
          anthropic: { ...anthropic, thinking: { ...thinking, budgetTokens } },
        }
      : input.providerOptions,
  }
}

/** Count the actual schemas sent to providers, including asynchronously converted Zod schemas. */
export async function estimateToolTokens(
  tools: ToolSet,
  activeTools?: readonly string[],
): Promise<number> {
  const schemas = await Promise.all(
    Object.entries(tools)
      .filter(([name]) => !activeTools || activeTools.includes(name))
      .map(async ([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: await asSchema(tool.inputSchema).jsonSchema,
      })),
  )
  return schemas.length ? estimateTokensFromText(JSON.stringify(schemas)) : 0
}
