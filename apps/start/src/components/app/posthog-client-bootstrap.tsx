'use client'

import { useEffect } from 'react'
import { initClientPostHog } from '@/lib/frontend/observability/posthog'
import type { PublicPostHogConfig } from '@/lib/shared/observability/posthog-config'

export function PostHogClientBootstrap({
  config,
}: {
  readonly config?: PublicPostHogConfig
}) {
  useEffect(() => {
    void initClientPostHog(config)
  }, [config])

  return null
}
