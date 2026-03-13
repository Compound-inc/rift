export const CHAT_ATTACHMENT_MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
export const CHAT_ATTACHMENT_MAX_UPLOAD_SIZE = '10m'
export const ORG_KNOWLEDGE_MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024
export const ORG_KNOWLEDGE_MAX_UPLOAD_SIZE = '25m'

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
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
] as const

export type UploadResponseBody = {
  key: string
  url: string
  name: string
  size: number
  contentType: string
}
