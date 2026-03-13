import {
  CHAT_ATTACHMENT_MAX_UPLOAD_SIZE_BYTES,
  ORG_KNOWLEDGE_MAX_UPLOAD_SIZE_BYTES,
} from './upload.model'

export type UploadValidationPolicy = {
  readonly acceptedFileTypes: string
  readonly allowedMimeTypes: ReadonlySet<string>
  readonly allowedExtensions: ReadonlySet<string>
  readonly maxSizeBytes: number
}

const CHAT_ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'text/html',
  'application/xml',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.text',
  'text/csv',
  'application/vnd.apple.numbers',
])

const CHAT_ATTACHMENT_ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'jpeg',
  'jpg',
  'png',
  'webp',
  'svg',
  'html',
  'htm',
  'xml',
  'xlsx',
  'xlsm',
  'xlsb',
  'xls',
  'et',
  'docx',
  'ods',
  'odt',
  'csv',
  'numbers',
])

const ORG_KNOWLEDGE_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
])

const ORG_KNOWLEDGE_ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'md',
  'markdown',
])

export const CHAT_ATTACHMENT_UPLOAD_POLICY: UploadValidationPolicy = {
  acceptedFileTypes: [
    '.pdf',
    '.jpeg',
    '.jpg',
    '.png',
    '.webp',
    '.svg',
    '.html',
    '.htm',
    '.xml',
    '.xlsx',
    '.xlsm',
    '.xlsb',
    '.xls',
    '.et',
    '.docx',
    '.ods',
    '.odt',
    '.csv',
    '.numbers',
  ].join(','),
  allowedMimeTypes: CHAT_ATTACHMENT_ALLOWED_MIME_TYPES,
  allowedExtensions: CHAT_ATTACHMENT_ALLOWED_EXTENSIONS,
  maxSizeBytes: CHAT_ATTACHMENT_MAX_UPLOAD_SIZE_BYTES,
}

export const ORG_KNOWLEDGE_UPLOAD_POLICY: UploadValidationPolicy = {
  acceptedFileTypes: [
    '.pdf',
    '.md',
    '.markdown',
    'application/pdf',
    'text/markdown',
  ].join(','),
  allowedMimeTypes: ORG_KNOWLEDGE_ALLOWED_MIME_TYPES,
  allowedExtensions: ORG_KNOWLEDGE_ALLOWED_EXTENSIONS,
  maxSizeBytes: ORG_KNOWLEDGE_MAX_UPLOAD_SIZE_BYTES,
}

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase()
  const dot = normalized.lastIndexOf('.')
  if (dot < 0 || dot === normalized.length - 1) return ''
  return normalized.slice(dot + 1)
}

/**
 * Upload validation is shared by browser UIs and backend services so the same
 * policy decides which file types are accepted for each upload surface.
 */
export function isAcceptedUploadFile(
  file: Pick<File, 'name' | 'type'>,
  policy: UploadValidationPolicy,
): boolean {
  const type = file.type.trim().toLowerCase()
  if (policy.allowedMimeTypes.has(type)) return true
  if (type && type !== 'application/octet-stream') return false

  const extension = getFileExtension(file.name)
  return extension.length > 0 && policy.allowedExtensions.has(extension)
}

export function getUploadValidationError(
  file: Pick<File, 'name' | 'type' | 'size'>,
  policy: UploadValidationPolicy,
): string | null {
  if (!isAcceptedUploadFile(file, policy)) {
    return 'File type is not supported for markdown conversion'
  }
  if (file.size <= 0) {
    return 'File is empty'
  }
  if (file.size > policy.maxSizeBytes) {
    return `File exceeds limit of ${Math.floor(policy.maxSizeBytes / (1024 * 1024))}MB`
  }
  return null
}
