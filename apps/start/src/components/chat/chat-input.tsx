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

export function ChatInput() {
  const { sendMessage, status, stop, error } = useChat()
  const [input, setInput] = useState('')
  const [errorDismissed, setErrorDismissed] = useState(false)
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
  const errorMessage =
    error?.message ?? (typeof error === 'string' ? error : null)
  const showError = !!errorMessage && !errorDismissed

  useEffect(() => {
    if (error) setErrorDismissed(false)
  }, [error])

  const handleDismissError = useCallback(() => setErrorDismissed(true), [])

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isBusy) return
      sendMessage({ text })
      setInput('')
    },
    [input, isBusy, sendMessage]
  )

  const topSlot = (
    <>
      {files.length > 0 && (
        <PromptInputAttachments files={files} onRemove={handleRemoveFile} />
      )}
      {showError ? (
        <PromptInputError
          error={errorMessage}
          onDismiss={handleDismissError}
        />
      ) : (
        <PromptInputThinking isVisible={isBusy} onCancel={stop} />
      )}
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
