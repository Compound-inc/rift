'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAvatarUpload } from './use-avatar-upload'

export type AvatarUploadFieldProps = {
  image?: string | null
  fallbackText: string
  alt: string
  onPersistImage: (uploadedUrl: string) => Promise<void>
  onImageChange?: (uploadedUrl: string) => void
  /** When provided, upload errors are reported here instead of rendered below the avatar */
  onUploadError?: (error: string | null) => void
  disabled?: boolean
  className?: string
}

/**
 * Generic avatar upload control used inside settings forms.
 *
 * It only owns upload UX (picker, uploading state, errors) and delegates
 * persistence to the parent via `onPersistImage`
 */
export function AvatarUploadField({
  image,
  fallbackText,
  alt,
  onPersistImage,
  onImageChange,
  onUploadError,
  disabled,
  className,
}: AvatarUploadFieldProps) {
  const {
    fileInputRef,
    isUploading,
    uploadError,
    accept,
    openFilePicker,
    handleFileChange,
  } = useAvatarUpload({
    onPersistImage,
    onImageChange,
  })

  useEffect(() => {
    onUploadError?.(uploadError)
  }, [uploadError, onUploadError])

  const [displayImage, setDisplayImage] = useState<string | null>(image ?? null)

  useEffect(() => {
    if (!image) {
      setDisplayImage(null)
      return
    }

    if (image === displayImage) {
      return
    }

    let isCancelled = false
    const preloadedImage = new window.Image()
    preloadedImage.onload = () => {
      if (!isCancelled) {
        setDisplayImage(image)
      }
    }

    preloadedImage.onerror = () => {
      if (!isCancelled) {
        setDisplayImage(image)
      }
    }

    preloadedImage.src = image

    return () => {
      isCancelled = true
    }
  }, [displayImage, image])

  return (
    <div className={cn('flex flex-col items-end gap-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          void handleFileChange(event)
        }}
      />

      <Button
        type="button"
        variant="ghost"
        size="default"
        onClick={openFilePicker}
        disabled={disabled || isUploading}
        aria-label="Upload avatar image"
        aria-busy={isUploading}
        className="h-auto w-auto cursor-pointer rounded-full border-0 bg-transparent p-0 hover:bg-transparent active:bg-transparent"
      >
        <Avatar className="relative !size-24" size="lg">
          {displayImage ? <AvatarImage src={displayImage} alt={alt} /> : null}
          <AvatarFallback>{fallbackText}</AvatarFallback>
          {isUploading ? (
            <>
              <span className="absolute inset-0 rounded-full bg-black/35 backdrop-blur-[1px]" aria-hidden />
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-white drop-shadow-sm" aria-hidden />
              </span>
            </>
          ) : null}
        </Avatar>
      </Button>

      {uploadError != null && onUploadError == null ? (
        <p className="max-w-52 text-right text-xs text-content-error" role="alert">
          {uploadError}
        </p>
      ) : null}
    </div>
  )
}
