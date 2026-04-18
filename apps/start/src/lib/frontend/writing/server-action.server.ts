import { Effect } from 'effect'
import {
  handleWritingServerActionFailure,
  WritingRuntime,
  WritingUnauthorizedError,
} from '@/lib/backend/writing'
import {
  runAuthenticatedServerAction,
} from '@/lib/backend/server-effect'
import type { AuthenticatedServerActionContext } from '@/lib/backend/server-effect'

export type WritingActionAuth = AuthenticatedServerActionContext

export async function runWritingAction<T>(input: {
  readonly operation: string
  readonly defaultMessage: string
  readonly program: (auth: WritingActionAuth) => Effect.Effect<T, unknown, any>
}) {
  return runAuthenticatedServerAction({
    runtime: WritingRuntime,
    onUnauthorized: (requestId) =>
      new WritingUnauthorizedError({
        message: 'Unauthorized',
        requestId,
      }),
    onFailure: ({ error, requestId, userId, organizationId }) =>
      handleWritingServerActionFailure({
        error,
        operation: input.operation,
        defaultMessage: input.defaultMessage,
        requestId,
        userId,
        organizationId,
      }),
    program: input.program,
  })
}
