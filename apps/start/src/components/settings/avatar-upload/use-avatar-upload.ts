'use client'

import { useMemo, useRef, useState } from 'react'
import { uploadFileToServer } from '@/lib/frontend/chat/upload'
import { CHAT_ATTACHMENT_MAX_UPLOAD_SIZE_BYTES } from '@/lib/shared/upload/upload.model'
import { m } from '@/paraglide/messages.js'

const DEFAULT_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
] as const

export type UseAvatarUploadOptions = {
  onPersistImage: (uploadedUrl: string) => Promise<void>
  onImageChange?: (uploadedUrl: string) => void
  acceptedMimeTypes?: readonly string[]
  maxSizeBytes?: number
}

export type UseAvatarUploadResult = {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  isUploading: boolean
  uploadError: string | null
  accept: string
  openFilePicker: () => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
}

/**
 * Shared avatar upload workflow used by settings forms.
 */
export function useAvatarUpload({
  onPersistImage,
  onImageChange,
  acceptedMimeTypes = DEFAULT_AVATAR_MIME_TYPES,
  maxSizeBytes = CHAT_ATTACHMENT_MAX_UPLOAD_SIZE_BYTES,
}: UseAvatarUploadOptions): UseAvatarUploadResult {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const normalizedMimeTypes = useMemo(
    () => acceptedMimeTypes.map((type) => type.trim().toLowerCase()),
    [acceptedMimeTypes],
  )

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    // Reset native input so selecting the same file again still triggers onChange.
    event.target.value = ''
    if (!selectedFile) return

    const normalizedType = selectedFile.type.trim().toLowerCase()
    if (!normalizedMimeTypes.includes(normalizedType)) {
      setUploadError(m.settings_avatar_upload_invalid_type())
      return
    }

    if (selectedFile.size > maxSizeBytes) {
      setUploadError(
        m.settings_avatar_upload_size_limit({
          maxSizeMb: String(Math.floor(maxSizeBytes / (1024 * 1024))),
        }),
      )
      return
    }

    setUploadError(null)
    setIsUploading(true)
    try {
      const uploaded = await uploadFileToServer(selectedFile)
      await onPersistImage(uploaded.url)
      onImageChange?.(uploaded.url)
    } catch (cause) {
      setUploadError(
        cause instanceof Error ? cause.message : m.settings_avatar_upload_failed(),
      )
    } finally {
      setIsUploading(false)
    }
  }

  return {
    fileInputRef,
    isUploading,
    uploadError,
    accept: acceptedMimeTypes.join(','),
    openFilePicker,
    handleFileChange,
  }
}
