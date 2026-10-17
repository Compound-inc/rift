import { getCatalogModel } from '@/lib/shared/ai-catalog'
import { DOCUMENT_TOOL_NAMES } from '@/lib/shared/documents/contracts'
import type {
  DocumentReadBudget,
  DocumentScope,
} from '@/lib/shared/documents/contracts'
import { ContextWindowExceededError } from '../../domain/errors'
import { MIN_ANSWER_TOKENS, resolveOutputLimits } from './output-limits'

/** These maps survive step replanning, but belong only to this request. */
export function createDocumentTurnState() {
  return {
    truncatedVersions: new Map<string, number>(),
    rewriteLimits: new Map<
      string,
      { version: number; maxRewriteTokens: number }
    >(),
  }
}

/** Keep ordinary answers at the catalog/context output limit. A tool result only
 * enters the prompt on the following step, so its potential read allowance must
 * not reduce the current answer. Actual results reduce the next step's output.
 */
export function planDocumentTurnStep(
  input: Parameters<typeof resolveOutputLimits>[0] & {
    toolsContext?: Record<string, unknown>
  },
  state = createDocumentTurnState(),
) {
  const limits = resolveOutputLimits(input)
  // A read's promise survives replanning. Stop before the next provider request
  // if accumulated responses leave too little output to honor that promise.
  const canContinue = [...state.rewriteLimits.values()].every(
    ({ maxRewriteTokens }) =>
      maxRewriteTokens <= Math.floor(limits.maxOutputTokens * 0.7),
  )
  const hasDocuments = DOCUMENT_TOOL_NAMES.some(
    (name) => input.toolsContext?.[name] !== undefined,
  )
  if (!hasDocuments)
    return { ...limits, canContinue, toolsContext: input.toolsContext ?? {} }

  const promptTokens = input.estimatedPromptTokens ?? 0
  const anthropic = limits.providerOptions?.anthropic as
    | { thinking?: { type?: string; budgetTokens?: number } }
    | undefined
  const thinkingTokens =
    anthropic?.thinking?.type === 'enabled'
      ? (anthropic.thinking.budgetTokens ?? 0)
      : 0
  const window =
    input.contextWindowTokens ??
    getCatalogModel(input.modelId)?.contextWindow ??
    promptTokens + limits.maxOutputTokens * 2 + thinkingTokens + 1024
  // Bound document results against a replacement and following answer. This
  // reservation governs tools only; ordinary generation retains the full limit.
  // Fixed thinking is already separate from text output, so subtract it once.
  const workingRoom = Math.max(
    0,
    Math.floor(
      window -
        promptTokens -
        Math.max(1024, promptTokens * 0.1) -
        thinkingTokens -
        MIN_ANSWER_TOKENS,
    ),
  )
  const documentOutputTokens = Math.min(
    limits.maxOutputTokens,
    Math.max(
      MIN_ANSWER_TOKENS,
      Math.min(32_768, Math.floor(workingRoom * 0.3)),
    ),
  )
  const documentReadTokens = Math.max(
    0,
    Math.floor((workingRoom - documentOutputTokens) * 0.7),
  )
  const documentReadBudget: DocumentReadBudget = {
    remainingTokens: documentReadTokens,
    ...state,
    projectRewriteTokens: (resultTokens) => {
      try {
        const next = resolveOutputLimits({
          ...input,
          // Include previous results in this step, this result, and room for
          // assistant/tool envelopes. prepareStep uses the actual replay later.
          estimatedPromptTokens:
            promptTokens +
            documentReadTokens -
            documentReadBudget.remainingTokens +
            resultTokens +
            MIN_ANSWER_TOKENS,
        })
        return Math.floor(
          Math.min(documentOutputTokens, next.maxOutputTokens) * 0.7,
        )
      } catch (error) {
        if (error instanceof ContextWindowExceededError) return 0
        throw error
      }
    },
  }
  const toolsContext = Object.fromEntries(
    Object.entries(input.toolsContext ?? {}).map(([name, context]) => [
      name,
      DOCUMENT_TOOL_NAMES.some((toolName) => toolName === name)
        ? {
            ...(context as DocumentScope),
            maxOutputTokens: limits.maxOutputTokens,
            documentReadTokens,
            documentReadBudget,
          }
        : context,
    ]),
  )
  return { ...limits, canContinue, toolsContext }
}
