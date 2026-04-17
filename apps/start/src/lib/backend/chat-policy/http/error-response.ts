import type { ChatPolicyDomainError } from '../domain/errors'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Converts typed chat policy domain errors into stable API responses.
 */
export function toChatPolicyErrorResponse(
  error: unknown,
  fallbackRequestId: string,
): Response {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('_tag' in error) ||
    typeof error._tag !== 'string'
  ) {
    return jsonResponse(
      {
        error: 'Chat policy route failed unexpectedly',
        requestId: fallbackRequestId,
      },
      500,
    )
  }

  const tagged = error as
    | ChatPolicyDomainError
    | {
        _tag: string
        message: string
        requestId?: string
        details?: unknown
      }
  const requestId =
    'requestId' in tagged && typeof tagged.requestId === 'string'
      ? tagged.requestId
      : fallbackRequestId

  if (tagged._tag === 'ChatPolicyUnauthorizedError') {
    return jsonResponse({ error: tagged.message, requestId }, 401)
  }

  if (
    tagged._tag === 'ChatPolicyMissingOrgContextError' ||
    tagged._tag === 'ChatPolicyInvalidRequestError'
  ) {
    return jsonResponse(
      {
        error: tagged.message,
        requestId,
        details: 'details' in tagged ? tagged.details : undefined,
      },
      400,
    )
  }

  if (tagged._tag === 'ChatPolicyPersistenceError') {
    return jsonResponse({ error: tagged.message, requestId }, 500)
  }

  if (tagged._tag === 'WorkspaceBillingFeatureUnavailableError') {
    return jsonResponse({ error: tagged.message, requestId }, 403)
  }

  return jsonResponse(
    { error: 'Chat policy route failed unexpectedly', requestId },
    500,
  )
}
