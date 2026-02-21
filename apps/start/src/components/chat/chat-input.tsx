'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChat } from './chat-context'
import {
  PromptInputRoot,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputThinking,
  PromptInputError,
  PromptInputAttachments,
} from './prompt-input'
import { useFileAttachments } from '../../hooks/chat/upload'
import { parseChatApiError } from './chat-error-messages'

export function ChatInput() {
  const { sendMessage, status, stop, error } = useChat()
  const [input, setInput] = useState('')
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [uploadErrorDismissed, setUploadErrorDismissed] = useState(false)
  const inputRef = useRef<{ focus: () => void }>(null)

  // File upload: images and PDF, max 10 files.
  const {
    files,
    handleFileSelect,
    handleRemoveFile,
    canAddMore,
  } = useFileAttachments({ maxFiles: 10 })

  const isBusy = status === 'submitted' || status === 'streaming'
  const isEmpty = !input.trim()
  const parsedChatError = parseChatApiError(error)
  const chatErrorMessage = parsedChatError?.message ?? null
  const chatErrorTraceId = parsedChatError?.traceId ?? null
  const uploadErrorMessage =
    files.find((file) => !!file.uploadError)?.uploadError ?? null
  const showChatError = !!chatErrorMessage && !errorDismissed
  const showUploadError = !!uploadErrorMessage && !uploadErrorDismissed
  const activeErrorMessage = showChatError
    ? chatErrorMessage
    : showUploadError
      ? uploadErrorMessage
      : null

  useEffect(() => {
    if (error) setErrorDismissed(false)
  }, [error])

  useEffect(() => {
    if (uploadErrorMessage) setUploadErrorDismissed(false)
  }, [uploadErrorMessage])

  const handleDismissError = useCallback(() => setErrorDismissed(true), [])
  const handleDismissUploadError = useCallback(
    () => setUploadErrorDismissed(true),
    []
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isBusy) return
      void sendMessage({ text })
        .then(() => {
          setInput('')
        })
        .catch(() => {
          // Error is surfaced by chat context.
        })
    },
    [input, isBusy, sendMessage]
  )

  const topSlot = (
    <>
      {activeErrorMessage ? (
        <PromptInputError
          error={activeErrorMessage}
          traceId={showChatError ? chatErrorTraceId : undefined}
          onDismiss={showChatError ? handleDismissError : handleDismissUploadError}
        />
      ) : null}
      {files.length > 0 && (
        <PromptInputAttachments files={files} onRemove={handleRemoveFile} />
      )}
      {!activeErrorMessage ? (
        <PromptInputThinking isVisible={isBusy} onCancel={stop} />
      ) : null}
    </>
  )

  return (
    <PromptInputRoot
      onSubmit={handleSubmit}
      className="w-full"
      slots={{ top: topSlot }}
    >
      <PromptInputTextarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isBusy}
        aria-label="Message"
      />

      <PromptInputToolbar
        canAddMore={canAddMore}
        onFileSelect={handleFileSelect}
        status={status}
        onStop={stop}
        isEmpty={isEmpty}
        isBusy={isBusy}
        onFocusInput={() => inputRef.current?.focus()}
      />
    </PromptInputRoot>
  )
}
