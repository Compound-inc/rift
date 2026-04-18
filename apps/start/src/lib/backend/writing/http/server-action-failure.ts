import {
  extractWritingErrorContext,
  getWritingErrorTag,
  toReadableWritingErrorCause,
  toReadableWritingErrorMessage,
} from '../domain/error-formatting'
import { logWritingFailure, type WritingFailureLogInput } from './failure-logging'

export type WritingServerActionFailureInput = Omit<
  WritingFailureLogInput,
  'surface' | 'route' | 'method'
>

/**
 * Server functions do not return custom JSON envelopes, so we convert domain
 * failures into a detailed `Error` message after logging the structured event.
 * This keeps the client-visible toast actionable during internal development.
 */
export async function handleWritingServerActionFailure(
  input: WritingServerActionFailureInput,
): Promise<never> {
  await logWritingFailure({
    ...input,
    surface: 'server-function',
  })

  throw new Error(formatWritingServerActionError(input))
}

export function formatWritingServerActionError(
  input: Pick<WritingServerActionFailureInput, 'error' | 'requestId' | 'defaultMessage' | 'operation'>,
): string {
  const errorTag = getWritingErrorTag(input.error)
  const readableMessage = toReadableWritingErrorMessage(input.error, input.defaultMessage)
  const readableCause = toReadableWritingErrorCause(
    input.error,
    'No additional error details',
  )
  const context = extractWritingErrorContext(input.error)

  const annotations = [
    `requestId: ${input.requestId}`,
    `tag: ${errorTag}`,
    `operation: ${input.operation}`,
    context.projectId ? `projectId: ${context.projectId}` : undefined,
    context.chatId ? `chatId: ${context.chatId}` : undefined,
    context.path ? `path: ${context.path}` : undefined,
    context.toolName ? `tool: ${context.toolName}` : undefined,
  ].filter(Boolean)

  const suffix = annotations.length > 0 ? ` (${annotations.join(', ')})` : ''
  const cause =
    readableCause && readableCause !== readableMessage ? `. Cause: ${readableCause}` : ''

  return `${readableMessage}${suffix}${cause}`
}
