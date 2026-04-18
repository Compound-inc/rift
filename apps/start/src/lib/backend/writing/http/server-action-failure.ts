import {
  formatServerActionErrorMessage,
  resolveBackendErrorMetadata,
} from '@/lib/backend/server-effect'
import {
  extractWritingErrorContext,
  toReadableWritingErrorCause,
  toReadableWritingErrorMessage,
} from '../domain/error-formatting'
import {
  classifyUnknownWritingError,
  classifyWritingError,
} from '../domain/error-classification'
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
  const resolved = resolveBackendErrorMetadata({
    error: input.error,
    fallbackRequestId: input.requestId,
    defaultMessage: input.defaultMessage,
    classifyTagged: classifyWritingError,
    classifyUnknown: classifyUnknownWritingError,
    toReadableMessage: toReadableWritingErrorMessage,
    toReadableCause: toReadableWritingErrorCause,
    extractContext: extractWritingErrorContext,
  })

  return formatServerActionErrorMessage({
    requestId: input.requestId,
    operation: input.operation,
    readableMessage: resolved.readableMessage,
    readableCause: resolved.readableCause,
    errorTag: resolved.errorTag,
    context: {
      projectId: resolved.context.projectId,
      chatId: resolved.context.chatId,
      path: resolved.context.path,
      toolName: resolved.context.toolName,
    },
    contextLabels: {
      toolName: 'tool',
    },
  })
}
