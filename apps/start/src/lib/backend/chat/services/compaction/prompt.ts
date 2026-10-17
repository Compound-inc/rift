import type { UIMessage } from 'ai'
import type { Effect } from 'effect'
import type {
  CompactionProgress,
  ThreadCompaction,
} from '@/lib/shared/chat-contracts/compaction'
import {
  estimatePromptTokens,
  estimateTokensFromText,
} from '@/lib/shared/chat-contracts/prompt-usage'
import type {
  EffectiveModelResolution,
  OrgAiPolicy,
} from '@/lib/shared/model-policy/types'
import type { AccessContext } from '@/lib/shared/access-control'
import type { AiContextWindowMode } from '@/lib/shared/ai-catalog'
import { InvalidRequestError } from '../../domain/errors'
import { resolveOutputLimits } from '../chat-orchestrator/output-limits'
import {
  compactionBudget,
  latestTurnCut,
  promptAfterCut,
  summarySection,
} from './planning'

export type CompactionInput = {
  readonly messages: UIMessage[]
  readonly threadId: string
  readonly userId: string
  readonly organizationId?: string
  readonly requestId: string
  readonly current: EffectiveModelResolution
  readonly orgPolicy?: OrgAiPolicy
  readonly accessContext?: AccessContext
  readonly skipProviderKeyResolution?: boolean
  readonly contextWindow: number
  readonly contextWindowMode: AiContextWindowMode
  readonly systemPrompt: string
  readonly toolTokens?: number
  readonly providerOptions?: Record<string, unknown>
  readonly abortSignal?: AbortSignal
  readonly progress: (progress: CompactionProgress) => void
  readonly onFallback: (cause: unknown) => Effect.Effect<void>
}

export type CompactionResult = {
  readonly messages: UIMessage[]
  readonly systemPrompt: string
  readonly reservedOutputTokens: number
  readonly promptTokens: number
  readonly checkpoint?: ThreadCompaction
}

/** Validate the irreducible turn before quota, compaction or any branch/message write. */
export function validateCompactionPrompt(
  input: CompactionInput,
  messages = promptAfterCut(input.messages, latestTurnCut(input.messages)),
  checkpoint?: ThreadCompaction,
): CompactionResult {
  if (messages.length === 0 || !messages.some((message) => message.role === 'user')) {
    throw new InvalidRequestError({
      message: 'Cannot generate a response without a user turn',
      requestId: input.requestId,
      issue: 'empty_generation_prompt',
    })
  }
  const budget = compactionBudget(
    input.current.modelId,
    input.contextWindow,
    input.systemPrompt,
    input.toolTokens,
  )
  const systemPrompt = [input.systemPrompt, summarySection(checkpoint)]
    .filter(Boolean)
    .join('\n\n')
  const promptTokens =
    estimatePromptTokens(messages) +
    estimateTokensFromText(systemPrompt) +
    (input.toolTokens ?? 0)
  resolveOutputLimits({
    modelId: input.current.modelId,
    estimatedPromptTokens: promptTokens,
    contextWindowTokens: input.contextWindow,
    maxOutputTokens: budget.reservedOutputTokens,
    providerOptions: input.providerOptions,
    requestId: input.requestId,
    threadId: input.threadId,
    contextWindowMode: input.contextWindowMode,
  })
  return {
    messages,
    systemPrompt,
    promptTokens,
    reservedOutputTokens: budget.reservedOutputTokens,
    checkpoint,
  }
}
