/**
 * Chat file upload: accepted types and helpers for building attachment entries.
 * Used by hooks/chat/upload and the chat input UI.
 */

/**
 * Accept string for <input accept=""> aligned with Cloudflare toMarkdown support:
 * PDF, common images, HTML/XML, Office/OpenDocument, CSV, and Numbers files.
 */
export const ACCEPTED_FILE_TYPES = [
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
].join(',')
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

export type UploadedFile = {
  id: string
  key: string
  url: string
  name: string
  size: number
  contentType: string
}

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
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

const SUPPORTED_EXTENSIONS = new Set([
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

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase()
  const dot = normalized.lastIndexOf('.')
  if (dot < 0 || dot === normalized.length - 1) return ''
  return normalized.slice(dot + 1)
}

export function isAcceptedFile(file: File): boolean {
  const type = file.type.trim().toLowerCase()
  if (SUPPORTED_MIME_TYPES.has(type)) return true
  if (type && type !== 'application/octet-stream') return false
  const extension = getFileExtension(file.name)
  return extension.length > 0 && SUPPORTED_EXTENSIONS.has(extension)
}

export function getFileValidationError(file: File): string | null {
  if (!isAcceptedFile(file)) {
    return 'File type is not supported for markdown conversion'
  }
  if (file.size <= 0) {
    return 'File is empty'
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `File exceeds limit of ${Math.floor(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))}MB`
  }
  return null
}

/**
 * Builds an attachment entry from a raw File (id, name, size, file, optional object URL for images).
 * Caller must call URL.revokeObjectURL(entry.preview) when removing the file.
 */
export function createAttachedFile(file: File): {
  id: string
  name: string
  size: number
  file: File
  preview?: string
} {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    file,
    preview:
      file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
  }
}

export async function uploadFileToServer(file: File): Promise<UploadedFile> {
  const formData = new FormData()
  formData.set('file', file)

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Upload failed with status ${response.status}`
    throw new Error(message)
  }

  return payload as UploadedFile
}
