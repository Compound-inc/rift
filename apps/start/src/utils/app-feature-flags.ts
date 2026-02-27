/**
 * App-level feature flags.
 *
 * Uses VITE_ prefixed env vars so both client and server can use the same
 * environment variable. This simplifies self-hosting - users only need to
 * set one env var per feature.
 */
type AppFeatureFlags = {
  readonly enableEmbedding: boolean
  readonly enableReasoningControls: boolean
  readonly enableAdvancedProviderTools: boolean
  readonly enableOrganizationProviderKeys: boolean
}

/**
 * Reads a boolean value from import.meta.env.
 * Works for both client (Vite build) and server (Nitro build).
 * Only VITE_ prefixed vars are exposed to the client.
 */
function readBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  if (value === 'true') return true
  if (value === 'false') return false
  return defaultValue
}

const APP_FEATURE_FLAGS: AppFeatureFlags = Object.freeze({
  enableEmbedding: readBooleanEnv('ENABLE_EMBEDDING', true),
  enableReasoningControls: true,
  enableAdvancedProviderTools: true,
  enableOrganizationProviderKeys: readBooleanEnv(
    'VITE_ENABLE_ORGANIZATION_PROVIDER_KEYS',
    false,
  ),
})

export function getAppFeatureFlags(): AppFeatureFlags {
  return APP_FEATURE_FLAGS
}

export function isEmbeddingFeatureEnabled(): boolean {
  return APP_FEATURE_FLAGS.enableEmbedding
}

export function canUseReasoningControls(): boolean {
  return APP_FEATURE_FLAGS.enableReasoningControls
}

export function canUseAdvancedProviderTools(): boolean {
  return APP_FEATURE_FLAGS.enableAdvancedProviderTools
}

export function canUseOrganizationProviderKeys(): boolean {
  return APP_FEATURE_FLAGS.enableOrganizationProviderKeys
}
