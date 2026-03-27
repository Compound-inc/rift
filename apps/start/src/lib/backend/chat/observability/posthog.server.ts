import { PostHog } from 'posthog-node'
import { getPublicPostHogConfig } from './posthog-config.server'
import type { ChatRequestWideEvent } from './wide-event'

let client: PostHog | undefined
let initialized = false
let shutdownRegistered = false

function registerShutdownHooks(instance: PostHog): void {
  if (shutdownRegistered) return
  shutdownRegistered = true

  const shutdown = () => {
    instance.shutdown(2_000)
  }

  process.once('beforeExit', shutdown)
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

function getClient(): PostHog | undefined {
  if (initialized) {
    return client
  }
  initialized = true

  const config = getPublicPostHogConfig()
  if (!config.apiKey) {
    client = undefined
    return undefined
  }

  client = new PostHog(config.apiKey, {
    host: config.apiHost,
    enableExceptionAutocapture: false,
  })
  registerShutdownHooks(client)
  return client
}

function buildFingerprint(event: ChatRequestWideEvent): string | undefined {
  const outcome = event.outcome
  if (!outcome || outcome.ok || !outcome.error) return undefined

  return [
    event.request.route,
    outcome.error.code ?? 'unknown',
    outcome.error.tag,
    outcome.captureMode,
  ].join(':')
}

/**
 * Mirrors finalized request failures into PostHog using the wide event as the
 * single source of truth for grouping, distinct IDs, and structured context.
 */
export async function captureChatWideEventInPostHog(
  event: ChatRequestWideEvent,
): Promise<void> {
  const config = getPublicPostHogConfig()
  const posthog = getClient()
  const outcome = event.outcome
  if (!posthog || !outcome || outcome.ok) return
  if (outcome.captureMode === 'none') return

  const error = new Error(outcome.error?.message ?? 'Chat request failed')
  error.name = outcome.error?.tag ?? 'ChatRequestError'

  await posthog.captureExceptionImmediate(error, event.actor.userId, {
    $exception_fingerprint: buildFingerprint(event),
    event_name: event.eventName,
    request_id: event.request.requestId,
    route: event.request.route,
    method: event.request.method,
    trigger: event.request.trigger,
    thread_id: event.thread.threadId,
    organization_id: event.actor.organizationId,
    model_id: event.model.resolvedModelId,
    error_code: outcome.error?.code,
    error_tag: outcome.error?.tag,
    retryable: outcome.retryable,
    telemetry_disposition: outcome.captureMode,
    actor: event.actor,
    thread: event.thread,
    model: event.model,
    policy: event.policy,
    stream: event.stream,
    usage: event.usage,
    outcome,
    breadcrumbs: event.breadcrumbs,
    cause: outcome.error?.cause,
    release: config.release,
    environment: config.environment,
  })
}
