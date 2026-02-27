'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AttachedFile } from '../../../components/chat/prompt-input'
import {
  createAttachedFile,
  getFileValidationError,
  uploadFileToServer,
} from '../../../lib/chat/upload'

export type UseFileAttachmentsOptions = {
  /** Maximum number of files allowed (default 10). */
  maxFiles?: number
}

/**
 * Hook for managing file attachments in the chat input.
 * Handles validation (images + PDF only), max count, and object URL cleanup on remove.
 */
export function useFileAttachments(options: UseFileAttachmentsOptions = {}) {
  const { maxFiles = 10 } = options
  const [files, setFiles] = useState<AttachedFile[]>([])
  const filesRef = useRef<AttachedFile[]>([])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  const markUploadSuccess = useCallback(
    (id: string, uploaded: NonNullable<AttachedFile['uploaded']>) => {
      setFiles((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, isUploading: false, uploadError: undefined, uploaded }
            : item,
        ),
      )
    },
    [],
  )

  const markUploadFailure = useCallback((id: string, message: string) => {
    setFiles((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, isUploading: false, uploadError: message }
          : item,
      ),
    )
  }, [])

  const uploadAttachment = useCallback(
    async (id: string, file: File) => {
      try {
        const uploaded = await uploadFileToServer(file)
        markUploadSuccess(id, uploaded)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to upload file'
        markUploadFailure(id, message)
      }
    },
    [markUploadFailure, markUploadSuccess],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      if (selected.length === 0) {
        e.target.value = ''
        return
      }
      const currentFiles = filesRef.current
      const remaining = maxFiles - currentFiles.length
      const toConsider = selected.slice(0, Math.max(0, remaining))
      if (toConsider.length === 0) {
        e.target.value = ''
        return
      }

      const queue: Array<{ id: string; file: File }> = []
      const nextItems = toConsider.map((file) => {
        const base = createAttachedFile(file)
        const validationError = getFileValidationError(file)
        if (validationError) {
          return {
            ...base,
            isUploading: false,
            uploadError: validationError,
          } satisfies AttachedFile
        }
        queue.push({ id: base.id, file })
        return {
          ...base,
          isUploading: true,
        } satisfies AttachedFile
      })

      const nextFiles = [...currentFiles, ...nextItems]
      filesRef.current = nextFiles
      setFiles(nextFiles)

      for (const item of queue) {
        void uploadAttachment(item.id, item.file)
      }

      e.target.value = ''
    },
    [maxFiles, uploadAttachment],
  )

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  /**
   * Clears all attachments from the composer and releases any preview object URLs.
   * This is used after a successful send so the UI reflects that files were consumed.
   */
  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      for (const item of prev) {
        if (item.preview) URL.revokeObjectURL(item.preview)
      }
      return []
    })
  }, [])

  return {
    files,
    handleFileSelect,
    handleRemoveFile,
    clearFiles,
    canAddMore: files.length < maxFiles,
    maxFiles,
  }
}
