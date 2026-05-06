export const DEFAULT_POSTHOG_HOST = 'https://z.rift.mx'
export const DEFAULT_POSTHOG_UI_HOST = 'https://us.posthog.com'

/**
 * Public PostHog settings that are safe to serialize into the app shell.
 * The same runtime metadata is used by both the server and browser so errors
 * can be grouped by the same release and environment.
 */
export type PublicPostHogConfig = {
  readonly apiKey?: string
  readonly apiHost: string
  readonly uiHost: string
  readonly environment?: string
  readonly release?: string
}
