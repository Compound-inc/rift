export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

/**
 * Public PostHog settings that are safe to serialize into the app shell.
 * The same runtime metadata is used by both the server and browser so errors
 * can be grouped by the same release and environment.
 */
export type PublicPostHogConfig = {
  readonly apiKey?: string
  readonly apiHost: string
  readonly environment?: string
  readonly release?: string
}
