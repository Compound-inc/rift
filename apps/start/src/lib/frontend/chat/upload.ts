/**
 * Chat file upload: accepted types and helpers for building attachment entries.
 * Used by hooks/chat/upload and the chat input UI.
 */

import {
  CHAT_ATTACHMENT_UPLOAD_POLICY,
  getUploadValidationError,
  isAcceptedUploadFile,
} from '@/lib/shared/upload/upload-validation'

/**
 * Accept string for <input accept=""> aligned with the shared chat attachment
 * upload policy used by both browser validation and the backend uploader.
 */
export const ACCEPTED_FILE_TYPES = CHAT_ATTACHMENT_UPLOAD_POLICY.acceptedFileTypes

export type UploadedFile = {
  id: string
  key: string
  url: string
  name: string
  size: number
  contentType: string
}

export function isAcceptedFile(file: File): boolean {
  return isAcceptedUploadFile(file, CHAT_ATTACHMENT_UPLOAD_POLICY)
}

export function getFileValidationError(file: File): string | null {
  return getUploadValidationError(file, CHAT_ATTACHMENT_UPLOAD_POLICY)
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
