import { Effect } from 'effect'
import { toReadableErrorCause } from '@/lib/backend/chat/domain/error-formatting'
import {
  emitWideErrorEvent,
  getErrorTag,
} from '@/lib/backend/chat/observability/wide-event'
import {
  SingularityPersistenceError,
  isSingularityDomainError,
} from '../domain/errors'

type SingularityActionFailureInput = {
  readonly error: unknown
  readonly requestId: string
  readonly route: string
  readonly eventName: string
  readonly userId?: string
  readonly organizationId?: string
  readonly defaultMessage: string
}

export async function handleSingularityActionFailure(
  input: SingularityActionFailureInput,
): Promise<never> {
  const {
    error,
    requestId,
    route,
    eventName,
    userId,
    organizationId,
    defaultMessage,
  } = input
  const errorTag = getErrorTag(error)
  const readableCause = toReadableErrorCause(error, defaultMessage)

  await Effect.runPromise(
    emitWideErrorEvent({
      eventName,
      route,
      requestId,
      userId,
      errorTag,
      message: defaultMessage,
      cause: readableCause,
    }),
  )

  if (isSingularityDomainError(error)) {
    throw error
  }

  throw new SingularityPersistenceError({
    message: defaultMessage,
    organizationId,
    cause: readableCause,
  })
}
