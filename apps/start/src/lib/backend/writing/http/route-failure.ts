import { logWritingFailure, type WritingFailureLogInput } from './failure-logging'
import { toWritingErrorResponse } from './error-response'

export type WritingRouteFailureInput = Omit<WritingFailureLogInput, 'surface'>

/**
 * Central route failure helper for writing endpoints. It keeps route handlers
 * thin while guaranteeing structured logs and a predictable JSON envelope.
 */
export async function handleWritingRouteFailure(
  input: WritingRouteFailureInput,
): Promise<Response> {
  await logWritingFailure({
    ...input,
    surface: 'route',
  })

  return toWritingErrorResponse(input.error, input.requestId, input.defaultMessage)
}
