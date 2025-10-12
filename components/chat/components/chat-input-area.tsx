import { useRef } from "react";
import { NoSubscriptionDialog } from "@/components/ui/no-subscription-dialog";
import {
  AttachmentsIcon,
  GlobeIcon,
} from "@/components/ui/icons/svg-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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
import { ModelSelector } from "@/components/ai/model-selector";
import type { FileAttachment } from "@/lib/file-utils";

interface ChatInputAreaProps {
  input: string;
  isSearchEnabled: boolean;
  quotaError: {
    type: "standard" | "premium";
    message: string;
    currentUsage: number;
    limit: number;
    otherTypeUsage: number;
    otherTypeLimit: number;
  } | null;
  showNoSubscriptionDialog: boolean;
  orgName?: string;
  uploadedAttachments: FileAttachment[];
  uploadingFiles: Array<{ file: File; isUploading: boolean }>;
  isSendingMessage: boolean;
  disableInput: boolean;
  isUploading: boolean;
  selectedModel: string;
  status: "ready" | "submitted" | "streaming" | "error";
  messages: any[];

  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSearchToggle: () => void;
  onQuotaErrorClose: () => void;
  onNoSubscriptionDialogClose: () => void;
  onAttachClick: () => void;
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onModelChange: (model: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onStop: () => void;

  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ChatInputArea({
  input,
  isSearchEnabled,
  quotaError,
  showNoSubscriptionDialog,
  orgName,
  uploadedAttachments,
  uploadingFiles,
  isSendingMessage,
  disableInput,
  isUploading,
  selectedModel,
  status,
  messages,
  onInputChange,
  onSearchToggle,
  onQuotaErrorClose,
  onNoSubscriptionDialogClose,
  onAttachClick,
  onFilesSelected,
  onRemoveFile,
  onModelChange,
  onSubmit,
  onStop,
  fileInputRef,
}: ChatInputAreaProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0">
      <div className="mx-auto w-full max-w-3xl px-2">
        {/* No Subscription Dialog */}
        <NoSubscriptionDialog
          isOpen={showNoSubscriptionDialog}
          onClose={onNoSubscriptionDialogClose}
          orgName={orgName}
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
                  {quotaError.type === "premium" ? "Premium" : "Standard"}{" "}
                  quota exceeded
                </div>
              </div>
              <button
                onClick={onQuotaErrorClose}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                aria-label="Close"
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
        <PromptInput onSubmit={onSubmit}>
          <PromptInputFilePreview
            files={
              isSendingMessage ? [] : [
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
              ]
            }
            onRemoveFile={onRemoveFile}
            disabled={disableInput}
          />
          <PromptInputTextarea
            onChange={onInputChange}
            value={input}
            disabled={disableInput || isUploading}
            placeholder="Escribe tu mensaje..."
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputFileUpload
                ref={fileInputRef}
                onFilesSelected={onFilesSelected}
                disabled={disableInput || isUploading}
              />
              <PromptInputButton
                onClick={onAttachClick}
                aria-label="Add attachments"
                disabled={disableInput || (uploadedAttachments.length + uploadingFiles.length) >= 5}
                title={
                  (uploadedAttachments.length + uploadingFiles.length) >= 5
                    ? "Maximum of 5 files allowed per message"
                    : "Add attachments"
                }
              >
                <AttachmentsIcon className="size-4" />
              </PromptInputButton>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PromptInputButton
                      onClick={onSearchToggle}
                      aria-label="Toggle web search"
                      disabled={disableInput}
                      variant={isSearchEnabled ? "default" : "ghost"}
                      className={
                        isSearchEnabled
                          ? "bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                          : ""
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
              </TooltipProvider>
              <ModelSelector
                value={selectedModel}
                onValueChange={onModelChange}
              />
            </PromptInputTools>
            <PromptInputSubmit
              disabled={disableInput}
              status={status}
              onStop={onStop}
            />
          </PromptInputToolbar>
        </PromptInput>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFilesSelected}
        />
      </div>
    </div>
  );
}
