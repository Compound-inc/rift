/** Keep even an empty answer when usage or tool work gives it billing history. */
export function shouldReplaceFailedResponse(
  message: {
    readonly status?: string
    readonly content: string
    readonly reasoning?: string | null
    readonly publicCost?: number | null
    readonly inputTokens?: number | null
    readonly outputTokens?: number | null
    readonly totalTokens?: number | null
  },
  hasDescendants = false,
): boolean {
  return (
    message.status === 'error' &&
    !message.content.trim() &&
    !message.reasoning?.trim() &&
    !((message.publicCost ?? 0) > 0) &&
    !((message.inputTokens ?? 0) > 0) &&
    !((message.outputTokens ?? 0) > 0) &&
    !((message.totalTokens ?? 0) > 0) &&
    !hasDescendants
  )
}

type RetryMessage = {
  readonly messageId: string
  readonly role: string
  readonly status?: string
  readonly model?: string
}

/** A POST can fail before persistence. Only persisted turns can regenerate. */
export function resolveRetryTarget(
  messages: readonly RetryMessage[],
): RetryMessage | undefined {
  const reversed = [...messages].reverse()
  const lastUser = reversed.findIndex((message) => message.role === 'user')
  if (lastUser < 0) return undefined
  const failure = reversed
    .slice(0, lastUser)
    .find(
      (message) => message.role === 'assistant' && message.status === 'error',
    )
  return failure ?? reversed[lastUser]
}
