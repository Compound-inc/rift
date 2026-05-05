'use client'

import { useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import {
  captureClientPageView,
  initClientPostHog,
} from '@/lib/frontend/observability/posthog'
import type { PublicPostHogConfig } from '@/lib/shared/observability/posthog-config'

export function PostHogClientBootstrap({
  config,
}: {
  readonly config?: PublicPostHogConfig
}) {
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    void Promise.resolve(initClientPostHog(config)).then((enabled) => {
      if (cancelled || !enabled) {
        return
      }

      captureClientPageView({
        pathname: location.pathname,
        search: location.searchStr,
        hash: location.hash,
      })
    })

    return () => {
      cancelled = true
    }
  }, [config, location.hash, location.pathname, location.searchStr])

  return null
}
