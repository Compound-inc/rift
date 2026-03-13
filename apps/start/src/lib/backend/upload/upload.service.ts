import type { UploadResponseBody } from '@/lib/shared/upload/upload.model'
import type { UploadValidationPolicy } from '@/lib/shared/upload/upload-validation'
import {
  CHAT_ATTACHMENT_UPLOAD_POLICY,
  getUploadValidationError,
} from '@/lib/shared/upload/upload-validation'

const R2_ENV_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
] as const

type R2EnvKey = (typeof R2_ENV_KEYS)[number]

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
}

type S3WriteOptions = {
  type?: string
  contentDisposition?: string
}

type BunS3ClientLike = {
  write: (path: string, data: File, options?: S3WriteOptions) => Promise<number>
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
let cachedR2Config: R2Config | null = null
let cachedR2Client: BunS3ClientLike | null = null

export class R2UploadServiceError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'R2UploadServiceError'
    this.statusCode = statusCode
  }
}

function getBunRuntime(): BunRuntimeLike {
  const bunRuntime = (globalThis as { Bun?: BunRuntimeLike }).Bun
  if (!bunRuntime?.S3Client) {
    throw new R2UploadServiceError(
      'Bun runtime with S3 bindings is required for uploads',
      500,
    )
  }
  return bunRuntime
}

function readRequiredEnv(key: R2EnvKey): string | null {
  const value = process.env[key]
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getR2Config(): R2Config {
  if (cachedR2Config) return cachedR2Config

  const missing = R2_ENV_KEYS.filter((key) => !readRequiredEnv(key))
  if (missing.length > 0) {
    throw new R2UploadServiceError(
      `R2 upload requires env variables: missing ${missing.join(', ')}`,
      500,
    )
  }

  cachedR2Config = {
    accountId: readRequiredEnv('R2_ACCOUNT_ID') as string,
    accessKeyId: readRequiredEnv('R2_ACCESS_KEY_ID') as string,
    secretAccessKey: readRequiredEnv('R2_SECRET_ACCESS_KEY') as string,
    bucket: readRequiredEnv('R2_BUCKET_NAME') as string,
    publicBaseUrl: readRequiredEnv('R2_PUBLIC_BASE_URL') as string,
  }

  return cachedR2Config
}

function getR2Client(): BunS3ClientLike {
  if (cachedR2Client) return cachedR2Client

  const config = getR2Config()
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`
  const bunRuntime = getBunRuntime()

  cachedR2Client = new bunRuntime.S3Client({
    bucket: config.bucket,
    region: 'auto',
    endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  })

  return cachedR2Client
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

function buildContentDisposition(fileName: string): string {
  const normalized = fileName.trim()
  const safeName = normalized.length > 0 ? normalized.replace(/["\\]/g, '_') : 'upload'
  return `inline; filename="${safeName}"`
}

export class R2UploadService {
  async upload(params: {
    userId: string
    file: File
    validationPolicy?: UploadValidationPolicy
  }): Promise<UploadResponseBody> {
    const file = params.file
    const validationPolicy = params.validationPolicy ?? CHAT_ATTACHMENT_UPLOAD_POLICY

    const validationError = getUploadValidationError(file, validationPolicy)
    if (validationError) {
      throw new R2UploadServiceError(
        validationError === 'File is empty'
          ? 'Uploaded file is empty'
          : validationError,
        400,
      )
    }

    const r2Config = getR2Config()
    const key = buildObjectKey(params.userId, file.name)
    const contentType = hasPdfExtension(file.name)
      ? 'application/pdf'
      : file.type || 'application/octet-stream'

    await getR2Client().write(key, file, {
      type: contentType,
      contentDisposition: buildContentDisposition(file.name),
    })

    return {
      key,
      url: buildPublicFileUrl(key, r2Config.publicBaseUrl),
      name: file.name,
      size: file.size,
      contentType,
    }
  }
}

export const r2UploadService = new R2UploadService()
