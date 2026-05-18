export const UPLOAD_STORAGE_PROVIDER_ENV = 'UPLOAD_STORAGE_PROVIDER'

export type UploadStorageProvider = 'cloudflare_r2' | 's3_compatible'

export type UploadStorageConfig = {
  readonly provider: UploadStorageProvider
  readonly bucket: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly endpoint: string
  readonly region: string
  readonly publicBaseUrl: string
  readonly publicUrlMode: 'path' | 'proxy_query'
}

export class UploadStorageConfigError extends Error {
  readonly missingKeys: readonly string[]

  constructor(message: string, missingKeys: readonly string[] = []) {
    super(message)
    this.name = 'UploadStorageConfigError'
    this.missingKeys = missingKeys
  }
}

/**
 * Returns the first non-empty env var from the provided aliases.
 *
 * This lets us support both explicit app-specific names (`S3_*`) and
 * Railway's automatic bucket variables (`ENDPOINT`, `BUCKET`, etc.).
 */
function readEnv(keys: readonly string[]): string | null {
  for (const key of keys) {
    const rawValue = process.env[key]
    if (!rawValue) continue
    const trimmed = rawValue.trim()
    if (trimmed.length > 0) return trimmed
  }

  return null
}

export function resolveUploadStorageProvider(): UploadStorageProvider {
  const provider =
    readEnv([UPLOAD_STORAGE_PROVIDER_ENV])?.toLowerCase() ?? 'cloudflare_r2'

  if (provider === 'cloudflare_r2' || provider === 'r2') {
    return 'cloudflare_r2'
  }

  if (
    provider === 's3' ||
    provider === 's3_compatible' ||
    provider === 'railway_s3' ||
    provider === 'railway'
  ) {
    return 's3_compatible'
  }

  throw new UploadStorageConfigError(
    `Unsupported ${UPLOAD_STORAGE_PROVIDER_ENV} value: ${provider}. Use cloudflare_r2 or s3_compatible.`,
  )
}

/**
 * Resolves Cloudflare R2 settings and normalizes them into the shared storage
 * config shape expected by the upload service.
 */
function resolveCloudflareR2Config(): UploadStorageConfig {
  const accountId = readEnv(['R2_ACCOUNT_ID'])
  const accessKeyId = readEnv(['R2_ACCESS_KEY_ID'])
  const secretAccessKey = readEnv(['R2_SECRET_ACCESS_KEY'])
  const bucket = readEnv(['R2_BUCKET_NAME'])
  const configuredPublicBaseUrl = readEnv(['R2_PUBLIC_BASE_URL'])
  const appBaseUrl = resolveAppBaseUrl()
  const publicBaseUrl =
    configuredPublicBaseUrl ??
    (appBaseUrl ? `${appBaseUrl.replace(/\/$/, '')}/api/files/object` : null)

  const missing = [
    !accountId ? 'R2_ACCOUNT_ID' : null,
    !accessKeyId ? 'R2_ACCESS_KEY_ID' : null,
    !secretAccessKey ? 'R2_SECRET_ACCESS_KEY' : null,
    !bucket ? 'R2_BUCKET_NAME' : null,
    !publicBaseUrl ? 'R2_PUBLIC_BASE_URL or BETTER_AUTH_URL' : null,
  ].filter((key): key is string => key != null)

  if (missing.length > 0) {
    throw new UploadStorageConfigError(
      `Cloudflare R2 upload requires env variables: missing ${missing.join(', ')}`,
      missing,
    )
  }

  return {
    provider: 'cloudflare_r2',
    bucket: bucket as string,
    accessKeyId: accessKeyId as string,
    secretAccessKey: secretAccessKey as string,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    publicBaseUrl: publicBaseUrl as string,
    publicUrlMode: isProxyObjectBaseUrl(publicBaseUrl as string)
      ? 'proxy_query'
      : 'path',
  }
}

function resolveAppBaseUrl(): string | null {
  return readEnv(['BETTER_AUTH_URL', 'VITE_BETTER_AUTH_URL'])
}

function isProxyObjectBaseUrl(url: string): boolean {
  return url.replace(/\/$/, '').endsWith('/api/files/object')
}

/**
 * Resolves generic S3-compatible settings.
 *
 * Railway buckets are supported through either explicit `S3_*` variables or
 * Railway's automatic variables (`ENDPOINT`, `ACCESS_KEY_ID`, etc.).
 */
function resolveS3CompatibleConfig(): UploadStorageConfig {
  const endpoint = readEnv(['S3_ENDPOINT', 'ENDPOINT'])
  const accessKeyId = readEnv(['S3_ACCESS_KEY_ID', 'ACCESS_KEY_ID'])
  const secretAccessKey = readEnv([
    'S3_SECRET_ACCESS_KEY',
    'SECRET_ACCESS_KEY',
  ])
  const bucket = readEnv(['S3_BUCKET_NAME', 'BUCKET'])
  const region = readEnv(['S3_REGION', 'REGION']) ?? 'auto'
  const configuredPublicBaseUrl = readEnv(['S3_PUBLIC_BASE_URL'])
  const appBaseUrl = resolveAppBaseUrl()
  const publicBaseUrl =
    configuredPublicBaseUrl ??
    (appBaseUrl ? `${appBaseUrl.replace(/\/$/, '')}/api/files/object` : null)

  const missing = [
    !endpoint ? 'S3_ENDPOINT (or ENDPOINT)' : null,
    !accessKeyId ? 'S3_ACCESS_KEY_ID (or ACCESS_KEY_ID)' : null,
    !secretAccessKey ? 'S3_SECRET_ACCESS_KEY (or SECRET_ACCESS_KEY)' : null,
    !bucket ? 'S3_BUCKET_NAME (or BUCKET)' : null,
    !publicBaseUrl ? 'S3_PUBLIC_BASE_URL or BETTER_AUTH_URL' : null,
  ].filter((key): key is string => key != null)

  if (missing.length > 0) {
    throw new UploadStorageConfigError(
      `S3-compatible upload requires env variables: missing ${missing.join(', ')}`,
      missing,
    )
  }

  return {
    provider: 's3_compatible',
    bucket: bucket as string,
    accessKeyId: accessKeyId as string,
    secretAccessKey: secretAccessKey as string,
    endpoint: (endpoint as string).replace(/\/$/, ''),
    region,
    publicBaseUrl: publicBaseUrl as string,
    publicUrlMode: isProxyObjectBaseUrl(publicBaseUrl as string)
      ? 'proxy_query'
      : 'path',
  }
}

export function resolveUploadStorageConfig(): UploadStorageConfig {
  const provider = resolveUploadStorageProvider()
  if (provider === 'cloudflare_r2') {
    return resolveCloudflareR2Config()
  }
  return resolveS3CompatibleConfig()
}

/**
 * Setup health only needs a true/false answer and should not fail the page.
 */
export function isUploadStorageConfigured(): boolean {
  try {
    resolveUploadStorageConfig()
    return true
  } catch {
    return false
  }
}

/**
 * Markdown request validation only needs the storage origin guard when a
 * public base URL was configured.
 */
export function readUploadPublicBaseUrl(): string | null {
  try {
    return resolveUploadStorageConfig().publicBaseUrl
  } catch {
    return null
  }
}
