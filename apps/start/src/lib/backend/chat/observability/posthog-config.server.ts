import {
  DEFAULT_POSTHOG_HOST,
  DEFAULT_POSTHOG_UI_HOST,
} from '@/lib/shared/observability/posthog-config'
import type { PublicPostHogConfig } from '@/lib/shared/observability/posthog-config'
import { isSelfHosted } from '@/utils/app-feature-flags'

function readTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

/**
 * Centralizes the PostHog config consumed by the backend drain, browser
 * bootstrap, and build-time source map upload so all exception paths share the
 * same ingest host and release metadata.
 */
export function getPublicPostHogConfig(): PublicPostHogConfig {
  const apiKey = !isSelfHosted
    ? readTrimmedEnv('POSTHOG_PROJECT_API_KEY')
    : undefined

  return {
    apiKey,
    apiHost: DEFAULT_POSTHOG_HOST,
    uiHost: DEFAULT_POSTHOG_UI_HOST,
    environment:
      readTrimmedEnv('RAILWAY_ENVIRONMENT_NAME')
      ?? readTrimmedEnv('NODE_ENV'),
    release:
      readTrimmedEnv('RAILWAY_GIT_COMMIT_SHA')
      ?? readTrimmedEnv('GITHUB_SHA'),
  }
}

export function getPostHogServerHost(): string {
  return readTrimmedEnv('POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST
}

export function getPostHogSourceMapConfig(): {
  readonly projectId?: string
  readonly personalApiKey?: string
} {
  if (isSelfHosted) {
    return {}
  }

  return {
    projectId: readTrimmedEnv('POSTHOG_PROJECT_ID'),
    personalApiKey: readTrimmedEnv('POSTHOG_PERSONAL_API_KEY'),
  }
}
