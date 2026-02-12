import { useMemo, useCallback } from "react";
import { useChatTranslations } from "@/contexts/locale-context";
import { NoSubscriptionDialog } from "@/components/ui/no-subscription-dialog";
import {
  AttachmentsIcon,
  GlobeIcon,
} from "@/components/ui/icons/svg-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ai/ui/tooltip";
import {
  PromptInput,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputFileUpload,
  PromptInputFilePreview,
} from "@/components/ai/prompt-input";
import { ChatErrorAlert } from "./chat-error-alert";
import { ModelSelectorPanel } from "@/components/ai/model-selector-panel";
import { InstructionSelector } from "@/components/custom-instructions/InstructionSelector";
import { SelectedInstructionPill } from "@/components/custom-instructions/SelectedInstructionPill";
import React, { forwardRef } from "react";
type ChatStatus = "submitted" | "streaming" | "ready" | "error";
import { useChatUIStore } from "../ui-store";
import { Effect } from "effect";
import { uploadWithStateEffect } from "../services/upload-service";
import { MAX_TOTAL_FILES } from "@/lib/file-utils";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ChatInputAreaProps {
  disableInput: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onStop: () => void;
  threadId?: string;
  // Pass status from parent to avoid duplicate subscriptions (5.1 Defer State Reads)
  status: ChatStatus;
}

const ChatInputAreaInner = forwardRef<HTMLDivElement, ChatInputAreaProps>(function ChatInputAreaInner(
  {
    disableInput,
    selectedModel,
    onModelChange,
    onSubmit,
    onStop,
    threadId,
    status,
  },
  ref,
) {
  const t = useChatTranslations();
  const input = useChatUIStore((s) => s.input);
  const isSearchEnabled = useChatUIStore((s) => s.isSearchEnabled);
  const quotaError = useChatUIStore((s) => s.quotaError);
  const showNoSubscriptionDialog = useChatUIStore((s) => s.showNoSubscriptionDialog);
  const uploadedAttachments = useChatUIStore((s) => s.uploadedAttachments);
  const uploadingFiles = useChatUIStore((s) => s.uploadingFiles);
  const isSendingMessage = useChatUIStore((s) => s.isSendingMessage);
  const isUploading = useChatUIStore((s) => s.isUploading);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const setInput = useChatUIStore((s) => s.setInput);
  const setSelectedFiles = useChatUIStore((s) => s.setSelectedFiles);
  const setUploadedAttachments = useChatUIStore((s) => s.setUploadedAttachments);
  const setUploadingFiles = useChatUIStore((s) => s.setUploadingFiles);
  const handleSearchToggle = useChatUIStore((s) => s.handleSearchToggle);
  const customInstructionId = useChatUIStore((s) => s.customInstructionId);
  const setCustomInstructionId = useChatUIStore((s) => s.setCustomInstructionId);
  const setQuotaError = useChatUIStore((s) => s.setQuotaError);
  const updateThreadCustomInstruction = useMutation(api.threads.updateThreadCustomInstruction);
  const setShowNoSubscriptionDialog = useChatUIStore((s) => s.setShowNoSubscriptionDialog);
  const triggerError = useChatUIStore((s) => s.triggerError);
  const setChatError = useChatUIStore((s) => s.setChatError);
  const [instructionSelectorOpen, setInstructionSelectorOpen] = React.useState(false);
  const handleInstructionChange = useCallback(
    async (instructionId: string | undefined) => {
      const previousInstructionId = useChatUIStore.getState().customInstructionId;

      // Update the store immediately for UI responsiveness
      setCustomInstructionId(instructionId);
      
      // If we're in a thread context, persist the change to the database
      if (threadId) {
        try {
          await updateThreadCustomInstruction({
            threadId,
            customInstructionId: instructionId
              ? (instructionId as Id<"customInstructions">)
              : undefined,
          });
        } catch (error) {
          console.error("Failed to update thread custom instruction:", error);
          // Revert the store change on error
          if (useChatUIStore.getState().customInstructionId === instructionId) {
            setCustomInstructionId(previousInstructionId);
          }
        }
      }
    },
    [threadId, setCustomInstructionId, updateThreadCustomInstruction]
  );

  const runUpload = useCallback(
    async (fileArray: File[]) => {
      if (!fileArray || fileArray.length === 0) return;

      await Effect.runPromise(
        uploadWithStateEffect(fileArray, {
          getState: useChatUIStore.getState,
          setSelectedFiles,
          setUploadingFiles,
          setUploadedAttachments,
          setChatError,
          triggerError,
        })
      );
    },
    [
      triggerError,
      setSelectedFiles,
      setUploadingFiles,
      setUploadedAttachments,
      setChatError,
    ]
  );
  // Memoize files array transformation
  const files = useMemo(() => {
    if (isSendingMessage) return [];
    
    return [
      // Show uploaded attachments first
      ...uploadedAttachments.map(att => ({
        name: att.fileName || 'Unknown file',
        type: att.mediaType,
        url: att.url,
        isUploading: false,
      })),
      // Then show uploading files at the end
      ...uploadingFiles.map(uf => ({
        name: uf.file.name,
        type: uf.file.type,
        isUploading: true,
      }))
    ];
  }, [isSendingMessage, uploadedAttachments, uploadingFiles]);

  // Memoize callbacks to prevent re-renders
  const handleRemoveFile = useCallback((index: number) => {
    const uploadedCount = uploadedAttachments.length;
    if (index < uploadedCount) {
      setUploadedAttachments((prev) => prev.filter((_, i) => i !== index));
    } else {
      const uploadingIndex = index - uploadedCount;
      setUploadingFiles((prev) => prev.filter((_, i) => i !== uploadingIndex));
    }
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setChatError(null);
  }, [uploadedAttachments.length, setUploadedAttachments, setUploadingFiles, setSelectedFiles, setChatError]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setChatError(null);
  }, [setInput, setChatError]);

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    void runUpload(fileArray);
  }, [runUpload]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (disableInput || isUploading) return;
      const clipboardData = e.clipboardData;
      if (!clipboardData?.files?.length) return;
      const pastedFiles = Array.from(clipboardData.files).filter((file) =>
        file.type.startsWith("image/")
      );
      if (pastedFiles.length === 0) return;
      const currentTotal = uploadedAttachments.length + uploadingFiles.length;
      const remainingSlots = Math.max(0, MAX_TOTAL_FILES - currentTotal);
      if (remainingSlots <= 0) return;
      e.preventDefault();
      const toUpload = pastedFiles.slice(0, remainingSlots);
      void runUpload(toUpload);
    },
    [
      disableInput,
      isUploading,
      uploadedAttachments.length,
      uploadingFiles.length,
      runUpload,
    ]
  );

  const handleAttachmentClick = useCallback(() => {
    if (disableInput) return;
    const currentTotalFiles = uploadedAttachments.length + uploadingFiles.length;
    if (currentTotalFiles >= MAX_TOTAL_FILES) {
      const errorMsg = `Máximo de ${MAX_TOTAL_FILES} archivos permitidos por mensaje`;
      triggerError(errorMsg);
      return;
    }
    setChatError(null);
    fileInputRef.current?.click();
  }, [disableInput, uploadedAttachments.length, uploadingFiles.length, triggerError, setChatError]);

  const handleInstructionPillClick = useCallback(() => {
    if (!disableInput) {
      setInstructionSelectorOpen(true);
    }
  }, [disableInput]);

  return (
    <div ref={ref} className="absolute bottom-0 left-0 right-0 md:pb-0 z-[20]">
      <div className="mx-auto w-full max-w-full md:max-w-3xl px-0 md:px-2 pb-0 md:pb-0 relative">
        {/* No Subscription Dialog */}
        <NoSubscriptionDialog
          isOpen={showNoSubscriptionDialog}
          onClose={() => setShowNoSubscriptionDialog(false)}
        />

        {/* Quota Error Message */}
        {quotaError && (
          <div className="mb-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg text-red-800 dark:text-red-200 text-sm shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-red-600 dark:text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="font-semibold">
                  Cuota
                  {quotaError.type === "premium" ? " Premium" : " Standard"}{" "}
                  excedida
                </div>
              </div>
              <button
                onClick={() => setQuotaError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                aria-label="Cerrar"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="text-red-700 dark:text-red-300">
              {quotaError.type === "premium" ? "Premium" : "Standard"}:{" "}
              {quotaError.limit > 0
                ? `${quotaError.currentUsage}/${quotaError.limit} mensajes`
                : "Límite alcanzado"}
              <br />
              {quotaError.type === "premium" ? "Standard" : "Premium"}:{" "}
              {quotaError.otherTypeLimit > 0
                ? `${quotaError.otherTypeUsage}/${quotaError.otherTypeLimit} mensajes`
                : "Cambiar a otros modelos"}
            </div>
          </div>
        )}
        <PromptInput onSubmit={onSubmit} borderClassName="border-border">
          <ChatErrorAlert />
          <PromptInputFilePreview
            files={files}
            onRemoveFile={handleRemoveFile}
            disabled={disableInput}
          />
          <PromptInputTextarea
            onChange={handleInputChange}
            value={input}
            disabled={disableInput || isUploading}
            placeholder={t.inputPlaceholder}
            onPaste={handlePaste}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputFileUpload
                ref={fileInputRef}
                onFilesSelected={handleFilesSelected}
                disabled={disableInput || isUploading}
              />
              <InstructionSelector
                selectedId={customInstructionId}
                onSelect={handleInstructionChange}
                disabled={disableInput}
                open={instructionSelectorOpen}
                onOpenChange={setInstructionSelectorOpen}
              />
              <PromptInputButton
                onClick={handleAttachmentClick}
                aria-label="Agregar archivos adjuntos"
                disabled={disableInput || (uploadedAttachments.length + uploadingFiles.length) >= MAX_TOTAL_FILES}
                title={
                  (uploadedAttachments.length + uploadingFiles.length) >= MAX_TOTAL_FILES
                    ? `Máximo de ${MAX_TOTAL_FILES} archivos permitidos por mensaje`
                    : "Agregar archivos adjuntos"
                }
              >
                <AttachmentsIcon className="size-4" />
              </PromptInputButton>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PromptInputButton
                    onClick={handleSearchToggle}
                    aria-label="Activar búsqueda web"
                    disabled={disableInput}
                    variant={isSearchEnabled ? "accent" : "ghost"}
                    className={
                      isSearchEnabled
                        ? "hover:bg-accent/50"
                        : undefined
                    }
                  >
                    <GlobeIcon className="size-4" />
                  </PromptInputButton>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  <p>
                    {isSearchEnabled ? "Desactivar" : "Activar"} búsqueda
                    web
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Buscar en la web información actual
                  </p>
                </TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-1">
                <ModelSelectorPanel
                  value={selectedModel}
                  onValueChange={onModelChange}
                />
                <SelectedInstructionPill 
                  instructionId={customInstructionId}
                  onClick={handleInstructionPillClick}
                />
              </div>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={disableInput || uploadingFiles.length > 0}
              status={status}
              onStop={onStop}
            />
          </PromptInputToolbar>
        </PromptInput>
        {/* Hidden file input handled by PromptInputFileUpload above via the same ref */}
      </div>
    </div>
  );
});

export const ChatInputArea = React.memo(ChatInputAreaInner);
