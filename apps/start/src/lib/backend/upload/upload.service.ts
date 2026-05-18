import type { UploadResponseBody } from '@/lib/shared/upload/upload.model'
import type { UploadValidationPolicy } from '@/lib/shared/upload/upload-validation'
import type { UploadStorageConfig } from './storage-config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  CHAT_ATTACHMENT_UPLOAD_POLICY,
  getUploadValidationError,
} from '@/lib/shared/upload/upload-validation'
import { resolveUploadStorageConfig } from './storage-config'

type S3WriteOptions = {
  type?: string
  contentDisposition?: string
}

type BunS3ClientLike = {
  write: (path: string, data: File, options?: S3WriteOptions) => Promise<number>
  file: (path: string) => Blob
}

type BunRuntimeLike = {
  S3Client: new (options: {
    bucket: string
    region: string
    endpoint: string
    accessKeyId: string
    secretAccessKey: string
  }) => BunS3ClientLike
}

const UPLOAD_PREFIX = 'uploads'
let cachedUploadStorageConfig: UploadStorageConfig | null = null
let cachedUploadClient: BunS3ClientLike | null = null

export class UploadServiceError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'UploadServiceError'
    this.statusCode = statusCode
  }
}

function getBunRuntime(): BunRuntimeLike {
  const bunRuntime = (globalThis as { Bun?: BunRuntimeLike }).Bun
  if (!bunRuntime?.S3Client) {
    throw new UploadServiceError(
      'Bun runtime with S3 bindings is required for uploads',
      500,
    )
  }
  return bunRuntime
}

function getUploadStorageConfig(): UploadStorageConfig {
  if (cachedUploadStorageConfig) return cachedUploadStorageConfig
  try {
    cachedUploadStorageConfig = resolveUploadStorageConfig()
  } catch (error) {
    throw new UploadServiceError(
      error instanceof Error
        ? error.message
        : 'Storage configuration is invalid',
      500,
    )
  }
  return cachedUploadStorageConfig
}

function getUploadClient(): BunS3ClientLike {
  if (cachedUploadClient) return cachedUploadClient

  const config = getUploadStorageConfig()
  const bunRuntime = getBunRuntime()

  cachedUploadClient = new bunRuntime.S3Client({
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  })

  return cachedUploadClient
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim()
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) return 'bin'
  return sanitizeSegment(trimmed.slice(dotIndex + 1)).toLowerCase() || 'bin'
}

function hasPdfExtension(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith('.pdf')
}

function buildObjectKey(userId: string, fileName: string): string {
  const now = Date.now()
  const extension = getFileExtension(fileName)
  const userPathSegment = sanitizeSegment(userId)
  const id = crypto.randomUUID()
  return `${UPLOAD_PREFIX}/${userPathSegment}/${now}-${id}.${extension}`
}

function buildPublicFileUrl(fileKey: string, publicBaseUrl: string): string {
  return `${publicBaseUrl.replace(/\/$/, '')}/${fileKey}`
}

function readUploadSigningSecret(): string | null {
  const raw = process.env.BETTER_AUTH_SECRET
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function signStorageKey(key: string, secret: string): string {
  return createHmac('sha256', secret).update(key).digest('hex')
}

export function verifyStorageKeySignature(input: {
  key: string
  signature: string
}): boolean {
  const secret = readUploadSigningSecret()
  if (!secret) return false
  const expected = signStorageKey(input.key, secret)

  const providedBuffer = Buffer.from(input.signature, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (providedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(providedBuffer, expectedBuffer)
}

function buildProxyFileUrl(fileKey: string, publicBaseUrl: string): string {
  const secret = readUploadSigningSecret()
  if (!secret) {
    throw new UploadServiceError(
      'BETTER_AUTH_SECRET is required to generate signed proxy file URLs',
      500,
    )
  }

  const url = new URL(publicBaseUrl)
  url.searchParams.set('key', fileKey)
  url.searchParams.set('sig', signStorageKey(fileKey, secret))
  return url.toString()
}

function buildContentDisposition(fileName: string): string {
  const normalized = fileName.trim()
  const safeName =
    normalized.length > 0 ? normalized.replace(/["\\]/g, '_') : 'upload'
  return `inline; filename="${safeName}"`
}

/**
 * Pins a `Content-Type` for served objects based on the file extension. The
 * proxy serves user-uploaded content from the app's own origin (when
 * `publicUrlMode === 'proxy_query'`); leaving the response without an
 * explicit `Content-Type` lets the browser sniff the body, which means a
 * file named `*.pdf` whose body is HTML could execute scripts on the app
 * origin. Combined with `X-Content-Type-Options: nosniff`, this guarantees
 * the browser renders the file as the type we declared at upload time.
 */
function resolveResponseContentType(key: string): string {
  return hasPdfExtension(key) ? 'application/pdf' : 'application/octet-stream'
}

export class UploadService {
  /**
   * Fetches an object from the configured S3-compatible backend and returns it
   * as a web `Response` payload.
   */
  readObjectByKey(params: { key: string }): Response {
    const config = getUploadStorageConfig()
    const objectFile = getUploadClient().file(params.key)
    const contentType = resolveResponseContentType(params.key)

    return new Response(objectFile, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=300',
        'Content-Type': contentType,
        // Prevent the browser from MIME-sniffing the response body. Without
        // this, a file uploaded as `.pdf` whose body is HTML could execute
        // scripts on the proxy's origin.
        'X-Content-Type-Options': 'nosniff',
        'x-rift-storage-provider': config.provider,
      },
    })
  }

  /**
   * Returns a URL that the browser can fetch directly for the object at
   * `key`.
   */
  buildAccessibleObjectUrl(params: { key: string }): string {
    const config = getUploadStorageConfig()
    if (config.publicUrlMode === 'proxy_query') {
      return buildProxyFileUrl(params.key, config.publicBaseUrl)
    }
    return buildPublicFileUrl(params.key, config.publicBaseUrl)
  }

  async upload(params: {
    userId: string
    file: File
    validationPolicy?: UploadValidationPolicy
  }): Promise<UploadResponseBody> {
    const file = params.file
    const validationPolicy =
      params.validationPolicy ?? CHAT_ATTACHMENT_UPLOAD_POLICY

    const validationError = getUploadValidationError(file, validationPolicy)
    if (validationError) {
      throw new UploadServiceError(
        validationError === 'File is empty'
          ? 'Uploaded file is empty'
          : validationError,
        400,
      )
    }

    const config = getUploadStorageConfig()
    const key = buildObjectKey(params.userId, file.name)
    const contentType = hasPdfExtension(file.name)
      ? 'application/pdf'
      : file.type || 'application/octet-stream'

    await getUploadClient().write(key, file, {
      type: contentType,
      contentDisposition: buildContentDisposition(file.name),
    })

    return {
      key,
      url:
        config.publicUrlMode === 'proxy_query'
          ? buildProxyFileUrl(key, config.publicBaseUrl)
          : buildPublicFileUrl(key, config.publicBaseUrl),
      name: file.name,
      size: file.size,
      contentType,
    }
  }
}

export const uploadService = new UploadService()
