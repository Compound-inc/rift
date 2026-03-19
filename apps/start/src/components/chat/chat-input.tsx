// Chat prompt input with error slot and file attachments.
'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useChatComposer, useChatMessages } from './chat-context'
import {
  PromptInputRoot,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputError,
  PromptInputAttachments,
} from './prompt-input'
import {
  ModelSelectorPanel,
  ReasoningSelectorPanel,
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage,
  ContextTrigger,
} from './composer-bar'
import { useFileAttachments } from '../../hooks/chat/upload/use-file-attachments'
import { parseChatApiError } from './chat-error-messages'
import { getChatModeDefinition } from '@/lib/shared/chat-modes'
import { m } from '@/paraglide/messages.js'
import { useContextUsage } from '@/hooks/chat/use-context-usage'
import {
  clearComposerDraft,
  getComposerDraftValue,
  setComposerDraft,
  useComposerDraftValue,
} from './composer-draft-store'
import type {
  ChatAttachment,
  ChatAttachmentInput,
} from '@/lib/shared/chat-contracts/attachments'

export function ChatInput() {
  const { branchCost, branchUsage, messages, showBranchCost } = useChatMessages()
  const {
    sendMessage,
    status,
    error,
    visibleModels,
    selectedModelId,
    selectedReasoningEffort,
    selectedContextWindowMode,
    setSelectedModelId,
    setSelectedReasoningEffort,
    setSelectedContextWindowMode,
    selectedModeId,
    isModeEnforced,
    setSelectedModeId,
    visibleTools,
    disabledToolKeys,
    setThreadDisabledToolKeys,
    activeContextWindow,
    contextWindowSupportsMaxMode,
    canUploadFiles,
    uploadUpgradeCallout,
  } = useChatComposer()

  const [errorDismissed, setErrorDismissed] = useState(false)
  const [uploadErrorDismissed, setUploadErrorDismissed] = useState(false)

  // File upload: worker-supported markdown-convertible files, max 10 files.
  const { files, handleFileSelect, handleRemoveFile, clearFiles, canAddMore } =
    useFileAttachments({
      maxFiles: 10,
      enabled: canUploadFiles,
      disabledMessage: uploadUpgradeCallout,
    })

  const isBusy = status === 'submitted' || status === 'streaming'
  const hasPendingUploads = files.some((file) => file.isUploading)
  const { usedTokens } = useContextUsage(messages)
  const isContextLimitReached = usedTokens >= activeContextWindow
  const contextLimitMessage = isContextLimitReached
    ? contextWindowSupportsMaxMode && selectedContextWindowMode === 'standard'
      ? 'This conversation has reached the standard context limit. Switch to Max to continue with the larger window.'
      : 'This conversation has reached its current context limit. Start a new chat to continue.'
    : null
  const isSendBlocked = isBusy || hasPendingUploads || isContextLimitReached
  const parsedChatError = parseChatApiError(error)
  const chatErrorMessage = parsedChatError?.message ?? null
  const chatErrorTraceId = parsedChatError?.traceId ?? null
  const uploadErrorMessage =
    files.find((file) => !!file.uploadError)?.uploadError ??
    null
  const showChatError = !!chatErrorMessage && !errorDismissed
  const showUploadError = !!uploadErrorMessage && !uploadErrorDismissed
  const activeErrorMessage = showChatError
    ? chatErrorMessage
    : showUploadError
      ? uploadErrorMessage
      : contextLimitMessage
        ? contextLimitMessage
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

  const buildAttachmentPayload = useCallback(() => {
    const uploadedFiles = files
      .map((file) => file.uploaded)
      .filter(
        (uploaded): uploaded is NonNullable<typeof uploaded> =>
          !!uploaded,
      )

    if (uploadedFiles.length === 0) return undefined

    const attachments = uploadedFiles
      .map((file): ChatAttachmentInput | null => {
        const attachmentId =
          typeof file.id === 'string' && file.id.trim().length > 0
            ? file.id.trim()
            : null
        return attachmentId ? { id: attachmentId } : null
      })
      .filter((attachment): attachment is ChatAttachmentInput => !!attachment)

    const attachmentManifest = uploadedFiles
      .map((file): ChatAttachment | null => {
        if (!file.id || !file.key || !file.url || !file.name || !file.contentType) {
          return null
        }
        return {
          id: file.id,
          key: file.key,
          url: file.url,
          name: file.name,
          size: file.size,
          contentType: file.contentType,
        }
      })
      .filter((attachment): attachment is ChatAttachment => !!attachment)

    return {
      attachments: attachments.length > 0 ? attachments : undefined,
      attachmentManifest:
        attachmentManifest.length > 0 ? attachmentManifest : undefined,
    }
  }, [files])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const text = getComposerDraftValue().trim()
      if (!text || isSendBlocked) return
      clearComposerDraft()

      try {
        const payload = buildAttachmentPayload()
        clearFiles()
        await sendMessage({
          text,
          attachments: payload?.attachments,
          attachmentManifest: payload?.attachmentManifest,
        })
      } catch (error) {
        setComposerDraft(text)
      }
    },
    [isSendBlocked, sendMessage, buildAttachmentPayload, clearFiles],
  )

  const selectedModel = visibleModels.find((m) => m.id === selectedModelId)
  const isStudyModeEnabled = selectedModeId === 'study'
  const studyModeDefinition = getChatModeDefinition('study')
  const modeLockedModelId = isStudyModeEnabled
    ? studyModeDefinition.fixedModelId
    : selectedModelId
  const reasoningOptions = selectedModel?.reasoningEfforts ?? []

  const hasReasoningOptions = !isStudyModeEnabled && reasoningOptions.length > 0
  const effectiveModelId =
    isStudyModeEnabled ? studyModeDefinition.fixedModelId : selectedModelId
  const selectorTriggerClassName =
    'h-8 rounded-full border border-transparent bg-transparent px-3 ltr:pr-7 rtl:pl-7 text-sm leading-[21px] font-medium text-foreground-strong transition-colors hover:bg-surface-inverse/5 active:bg-surface-inverse/10 focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-border-strong/40'

  const modelAndReasoningSelectors = (
    <div className="flex items-center gap-1">
      {isStudyModeEnabled ? (
        <div
          className={`${selectorTriggerClassName} inline-flex items-center gap-1.5 ltr:pr-3 rtl:pl-3`}
        >
          <BookOpen className="size-4 text-blue-500" aria-hidden />
          <span className="pointer-events-none">{m.chat_mode_study_label()}</span>
        </div>
      ) : (
        <ModelSelectorPanel
          value={modeLockedModelId}
          onValueChange={setSelectedModelId}
          options={visibleModels.map((m) => ({
            id: m.id,
            name: m.name,
            locked: m.locked,
            minimumPlanId: m.minimumPlanId,
          }))}
          className={selectorTriggerClassName}
        />
      )}
      {hasReasoningOptions && (
        <ReasoningSelectorPanel
          value={selectedReasoningEffort}
          onValueChange={setSelectedReasoningEffort}
          options={reasoningOptions}
          defaultReasoningEffort={selectedModel?.defaultReasoningEffort}
          className={selectorTriggerClassName}
        />
      )}
    </div>
  )

  const bottomSlot = (
    <div className="flex items-center justify-between gap-2 px-1 p-1.5">
      {modelAndReasoningSelectors}
      {effectiveModelId ? (
        <Context
          maxTokens={activeContextWindow}
          modelId={effectiveModelId}
          usedTokens={usedTokens}
          usage={branchUsage}
          totalCost={branchCost}
          showCost={showBranchCost}
        >
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
            <ContextContentBody>
              <div className="space-y-2">
                <ContextInputUsage />
                <ContextOutputUsage />
                <ContextReasoningUsage />
                <ContextCacheUsage />
              </div>
            </ContextContentBody>
            <ContextContentFooter />
          </ContextContent>
        </Context>
      ) : null}
    </div>
  )

  const topSlot = (
    <>
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
    </>
  )

  return (
    <PromptInputRoot
      onSubmit={handleSubmit}
      className="w-full"
      slots={{ top: topSlot, bottom: bottomSlot }}
    >
      <ComposerToolbar
        canAddMore={canAddMore}
        canUploadFiles={canUploadFiles}
        uploadUpgradeCallout={uploadUpgradeCallout}
        onFileSelect={handleFileSelect}
        status={status}
        isBusy={isSendBlocked}
        isStudyModeEnabled={isStudyModeEnabled}
        isModeEnforced={isModeEnforced}
        setSelectedModeId={setSelectedModeId}
        visibleTools={visibleTools}
        disabledToolKeys={disabledToolKeys}
        setThreadDisabledToolKeys={setThreadDisabledToolKeys}
        selectedContextWindowMode={selectedContextWindowMode}
        setSelectedContextWindowMode={setSelectedContextWindowMode}
        contextWindowSupportsMaxMode={contextWindowSupportsMaxMode}
      />
    </PromptInputRoot>
  )
}

const ComposerTextarea = memo(function ComposerTextarea() {
  const composerInput = useComposerDraftValue()

  return (
    <PromptInputTextarea
      value={composerInput}
      onChange={(e) => setComposerDraft(e.target.value)}
      aria-label={m.chat_input_message_aria_label()}
      placeholder={m.chat_prompt_placeholder()}
      className="placeholder:text-foreground-primary/65"
    />
  )
})

const ComposerToolbar = memo(function ComposerToolbar({
  canAddMore,
  canUploadFiles,
  uploadUpgradeCallout,
  onFileSelect,
  status,
  isBusy,
  isStudyModeEnabled,
  isModeEnforced,
  setSelectedModeId,
  visibleTools,
  disabledToolKeys,
  setThreadDisabledToolKeys,
  selectedContextWindowMode,
  setSelectedContextWindowMode,
  contextWindowSupportsMaxMode,
}: {
  canAddMore: boolean
  canUploadFiles: boolean
  uploadUpgradeCallout?: string
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  status: ReturnType<typeof useChatComposer>['status']
  isBusy: boolean
  isStudyModeEnabled: boolean
  isModeEnforced: boolean
  setSelectedModeId: ReturnType<typeof useChatComposer>['setSelectedModeId']
  visibleTools: ReturnType<typeof useChatComposer>['visibleTools']
  disabledToolKeys: ReturnType<typeof useChatComposer>['disabledToolKeys']
  setThreadDisabledToolKeys: ReturnType<typeof useChatComposer>['setThreadDisabledToolKeys']
  selectedContextWindowMode: ReturnType<typeof useChatComposer>['selectedContextWindowMode']
  setSelectedContextWindowMode: ReturnType<typeof useChatComposer>['setSelectedContextWindowMode']
  contextWindowSupportsMaxMode: ReturnType<typeof useChatComposer>['contextWindowSupportsMaxMode']
}) {
  const composerInput = useComposerDraftValue()
  const isEmpty = !composerInput.trim()

  return (
    <PromptInputToolbar
      canAddMore={canAddMore}
      canUploadFiles={canUploadFiles}
      uploadUpgradeCallout={uploadUpgradeCallout}
      onFileSelect={onFileSelect}
      status={status}
      isEmpty={isEmpty}
      isBusy={isBusy}
      isStudyModeEnabled={isStudyModeEnabled}
      isModeEnforced={isModeEnforced}
      onToggleStudyMode={() =>
        void setSelectedModeId(isStudyModeEnabled ? undefined : 'study')}
      visibleTools={visibleTools}
      disabledToolKeys={disabledToolKeys}
      onToolDisabledKeysChange={(nextDisabledToolKeys) =>
        void setThreadDisabledToolKeys(nextDisabledToolKeys)
      }
      contextWindowSupportsMaxMode={contextWindowSupportsMaxMode}
      isMaxContextEnabled={selectedContextWindowMode === 'max'}
      onMaxContextChange={(enabled) =>
        void setSelectedContextWindowMode(enabled ? 'max' : 'standard')
      }
      middle={<ComposerTextarea />}
    />
  )
})
