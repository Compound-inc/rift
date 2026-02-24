// Chat prompt input with error slot and file attachments.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatActions } from './chat-context'
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
import { ModelSelectorMenu } from './model-selector-menu'

export function ChatInput() {
  const {
    sendMessage,
    status,
    error,
    selectableModels,
    selectedModelId,
    selectedReasoningEffort,
    setSelectedModelId,
    setSelectedReasoningEffort,
  } = useChatActions()
  const [input, setInput] = useState('')
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [uploadErrorDismissed, setUploadErrorDismissed] = useState(false)
  const inputRef = useRef<{ focus: () => void }>(null)

  // File upload: images and PDF, max 10 files.
  const { files, handleFileSelect, handleRemoveFile, canAddMore } =
    useFileAttachments({ maxFiles: 10 })

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
    [],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isBusy) return
      setInput('')
      void sendMessage({ text }).catch(() => {
        setInput(text)
        // Error is surfaced by chat context.
      })
    },
    [input, isBusy, sendMessage],
  )

  const topSlot = (
    <>
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <ModelSelectorMenu
          value={selectedModelId}
          options={selectableModels}
          disabled={isBusy}
          onValueChange={setSelectedModelId}
        />
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={selectedReasoningEffort ?? ''}
          onChange={(e) =>
            setSelectedReasoningEffort(
              e.target.value
                ? (e.target.value as
                    | 'none'
                    | 'minimal'
                    | 'low'
                    | 'medium'
                    | 'high'
                    | 'xhigh')
                : undefined,
            )
          }
          disabled={isBusy}
          aria-label="Reasoning"
        >
          <option value="">Default reasoning</option>
          {(
            selectableModels.find((model) => model.id === selectedModelId)
              ?.reasoningEfforts ?? []
          ).map((effort) => (
            <option key={effort} value={effort}>
              {effort}
            </option>
          ))}
        </select>
        <div className="text-xs text-content-muted">
          Tools:{' '}
          {(
            selectableModels.find((model) => model.id === selectedModelId)
              ?.visibleTools ?? []
          ).join(', ') || 'None'}
        </div>
      </div>
      {activeErrorMessage ? (
        <PromptInputError
          error={activeErrorMessage}
          traceId={showChatError ? chatErrorTraceId : undefined}
          onDismiss={
            showChatError ? handleDismissError : handleDismissUploadError
          }
        />
      ) : null}
      {files.length > 0 && (
        <PromptInputAttachments files={files} onRemove={handleRemoveFile} />
      )}
      {!activeErrorMessage ? <PromptInputThinking isVisible={isBusy} /> : null}
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
        isEmpty={isEmpty}
        isBusy={isBusy}
        onFocusInput={() => inputRef.current?.focus()}
      />
    </PromptInputRoot>
  )
}
