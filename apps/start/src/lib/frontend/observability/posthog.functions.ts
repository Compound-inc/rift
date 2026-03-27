import { createServerFn } from '@tanstack/react-start'

export const getPublicPostHogConfigFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { getPublicPostHogConfig } =
    await import('@/lib/backend/chat/observability/posthog-config.server')

  return getPublicPostHogConfig()
})
