'use client'

import posthog from 'posthog-js/dist/module.slim'
import {
  AnalyticsExtensions,
  ErrorTrackingExtensions,
} from 'posthog-js/dist/extension-bundles'
import type { PublicPostHogConfig } from '@/lib/shared/observability/posthog-config'

let initialized = false
let enabled = false
let identifiedUserId: string | undefined

const CHAT_SCOPE_KEYS = [
  'chat_scope',
  'chat_is_anonymous',
  'organization_id',
  'thread_id',
  'chat_model_id',
  'chat_mode_id',
  'chat_context_window_mode',
  'chat_reasoning_effort',
] as const

function clearMissingScopeProperties(
  scope: Partial<Record<(typeof CHAT_SCOPE_KEYS)[number], string>>,
): void {
  for (const key of CHAT_SCOPE_KEYS) {
    if (!(key in scope)) {
      posthog.unregister(key)
    }
  }
}

/**
 * Initializes browser-side PostHog once, before the first pageview is captured.
 * TanStack Router owns navigation, so pageview events are emitted manually from
 * the bootstrap component instead of relying on PostHog history patching.
 */
export function initClientPostHog(config?: PublicPostHogConfig): boolean {
  if (initialized) return enabled
  initialized = true

  const resolvedConfig = config
  if (!resolvedConfig?.apiKey) {
    enabled = false
    return false
  }

  posthog.init(resolvedConfig.apiKey, {
    api_host: resolvedConfig.apiHost,
    ui_host: resolvedConfig.uiHost,
    defaults: '2026-01-30',
    capture_performance: {
      web_vitals: true,
      web_vitals_allowed_metrics: ['CLS', 'FCP', 'INP', 'LCP'],
    },
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    disable_surveys: true,
    disable_persistence: false,
    loaded: (client) => {
      if (resolvedConfig.environment) {
        client.register({ environment: resolvedConfig.environment })
      }
      if (resolvedConfig.release) {
        client.register({ release: resolvedConfig.release })
      }
    },
    __extensionClasses: {
      ...AnalyticsExtensions,
      ...ErrorTrackingExtensions,
    },
  })
  posthog.startExceptionAutocapture()

  enabled = true
  return true
}

export function isClientPostHogEnabled(): boolean {
  return enabled
}

export function captureClientPageView(input: {
  readonly pathname: string
  readonly search?: string
  readonly hash?: string
}): void {
  if (!isClientPostHogEnabled()) return

  const path = `${input.pathname}${input.search ?? ''}${input.hash ?? ''}`
  const href =
    typeof window === 'undefined'
      ? path
      : new URL(path || '/', window.location.origin).href

  posthog.capture('$pageview', {
    $current_url: href,
    path,
  })
}

/**
 * Keeps global PostHog identity aligned with the current app auth state so
 * browser-wide exception capture can correlate issues across chat and any other
 * client workflows that run under the same user session.
 */
export function setClientIdentity(input: {
  readonly userId?: string
  readonly organizationId?: string | null
  readonly isAnonymous?: boolean
}): void {
  if (!isClientPostHogEnabled()) return

  if (input.userId) {
    if (identifiedUserId !== input.userId) {
      posthog.identify(input.userId)
      identifiedUserId = input.userId
    }
    posthog.setPersonProperties({
      organization_id: input.organizationId ?? null,
      chat_is_anonymous: Boolean(input.isAnonymous),
    })
    return
  }

  if (identifiedUserId) {
    posthog.reset()
    identifiedUserId = undefined
  }
}

/**
 * Keeps global PostHog state aligned with the active chat session so both
 * explicit browser captures and auto-captured exceptions include thread/model
 * context without duplicating server-reported envelopes.
 */
export function setClientChatScope(input: {
  readonly userId?: string
  readonly organizationId?: string | null
  readonly threadId?: string
  readonly modelId?: string
  readonly modeId?: string
  readonly contextWindowMode?: string
  readonly reasoningEffort?: string
  readonly isAnonymous?: boolean
}): void {
  if (!isClientPostHogEnabled()) return

  setClientIdentity(input)

  const scope = {
    chat_scope: 'active',
    chat_is_anonymous: String(Boolean(input.isAnonymous)),
    ...(input.organizationId ? { organization_id: input.organizationId } : {}),
    ...(input.threadId ? { thread_id: input.threadId } : {}),
    ...(input.modelId ? { chat_model_id: input.modelId } : {}),
    ...(input.modeId ? { chat_mode_id: input.modeId } : {}),
    ...(input.contextWindowMode
      ? { chat_context_window_mode: input.contextWindowMode }
      : {}),
    ...(input.reasoningEffort
      ? { chat_reasoning_effort: input.reasoningEffort }
      : {}),
  }

  clearMissingScopeProperties(scope)
  posthog.register(scope)
}

/**
 * Generic browser-side exception hook for app code that wants to enrich an
 * error before forwarding it to PostHog.
 */
export function captureClientError(input: {
  readonly error: unknown
  readonly properties?: Readonly<Record<string, unknown>>
}): void {
  if (!isClientPostHogEnabled()) return

  const error =
    input.error instanceof Error
      ? input.error
      : new Error(
          typeof input.error === 'string' ? input.error : 'Client error',
        )

  posthog.captureException(error, input.properties)
}

/**
 * Captures client-side chat failures when the browser layer fails outside the
 * normalized backend envelope path.
 */
export function captureClientChatError(input: {
  readonly error: unknown
  readonly requestId?: string | null
  readonly code?: string
  readonly traceId?: string | null
  readonly telemetryOwner?: 'server'
  readonly status?: string
  readonly threadId?: string
  readonly details?: Readonly<Record<string, unknown>>
}): void {
  if (!shouldCaptureClientChatError(input)) return

  captureClientError({
    error: input.error,
    properties: {
      capture_origin: 'chat_client',
      telemetry_disposition: 'exception',
      chat_error_code: input.code,
      request_id: input.requestId ?? input.traceId ?? undefined,
      thread_id: input.threadId,
      chat_status: input.status,
      ...input.details,
    },
  })
}

/**
 * Client capture is reserved for browser-side failures or malformed transport
 * errors. Normalized backend envelopes are already represented by the
 * server-side request lifecycle and should not be duplicated.
 */
export function shouldCaptureClientChatError(input: {
  readonly code?: string
  readonly traceId?: string | null
  readonly requestId?: string | null
  readonly telemetryOwner?: 'server'
}): boolean {
  if (input.telemetryOwner === 'server') {
    return false
  }
  if (input.traceId || input.requestId) {
    return false
  }
  if (input.code) {
    return false
  }
  return true
}
