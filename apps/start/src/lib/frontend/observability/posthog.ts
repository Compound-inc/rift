import {
  createClientOnlyFn,
  createIsomorphicFn,
} from '@tanstack/react-start'
import type { PublicPostHogConfig } from '@/lib/shared/observability/posthog-config'

const initClientPostHogClient = createClientOnlyFn(
  async (config?: PublicPostHogConfig): Promise<boolean> => {
    const mod = await import('./posthog.client')
    return mod.initClientPostHog(config)
  },
)

const setClientIdentityClient = createClientOnlyFn(
  async (input: Parameters<typeof import('./posthog.client')['setClientIdentity']>[0]) => {
    const mod = await import('./posthog.client')
    mod.setClientIdentity(input)
  },
)

const setClientChatScopeClient = createClientOnlyFn(
  async (input: Parameters<typeof import('./posthog.client')['setClientChatScope']>[0]) => {
    const mod = await import('./posthog.client')
    mod.setClientChatScope(input)
  },
)

const captureClientErrorClient = createClientOnlyFn(
  async (input: Parameters<typeof import('./posthog.client')['captureClientError']>[0]) => {
    const mod = await import('./posthog.client')
    mod.captureClientError(input)
  },
)

const captureClientChatErrorClient = createClientOnlyFn(
  async (
    input: Parameters<typeof import('./posthog.client')['captureClientChatError']>[0],
  ) => {
    const mod = await import('./posthog.client')
    mod.captureClientChatError(input)
  },
)

const shouldCaptureClientChatErrorClient = createClientOnlyFn(
  async (
    input: Parameters<typeof import('./posthog.client')['shouldCaptureClientChatError']>[0],
  ) => {
    const mod = await import('./posthog.client')
    return mod.shouldCaptureClientChatError(input)
  },
)

export const initClientPostHog = createIsomorphicFn()
  .client((config?: PublicPostHogConfig) => initClientPostHogClient(config))
  .server(() => false)

export const setClientIdentity = createIsomorphicFn()
  .client(
    (
      input: Parameters<typeof import('./posthog.client')['setClientIdentity']>[0],
    ) => {
      void setClientIdentityClient(input)
    },
  )
  .server(() => undefined)

export const setClientChatScope = createIsomorphicFn()
  .client(
    (
      input: Parameters<typeof import('./posthog.client')['setClientChatScope']>[0],
    ) => {
      void setClientChatScopeClient(input)
    },
  )
  .server(() => undefined)

export const captureClientError = createIsomorphicFn()
  .client(
    (
      input: Parameters<typeof import('./posthog.client')['captureClientError']>[0],
    ) => {
      void captureClientErrorClient(input)
    },
  )
  .server(() => undefined)

export const captureClientChatError = createIsomorphicFn()
  .client(
    (
      input: Parameters<typeof import('./posthog.client')['captureClientChatError']>[0],
    ) => {
      void captureClientChatErrorClient(input)
    },
  )
  .server(() => undefined)

export const shouldCaptureClientChatError = createIsomorphicFn()
  .client(
    (
      input: Parameters<
        typeof import('./posthog.client')['shouldCaptureClientChatError']
      >[0],
    ) => shouldCaptureClientChatErrorClient(input),
  )
  .server(() => false)
