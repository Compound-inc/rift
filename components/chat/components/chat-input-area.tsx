import { useMemo } from "react";
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
  PromptInputError,
} from "@/components/ai/prompt-input";
import { ModelSelector } from "@/components/ai/model-selector";
import { ResponseStyleSelector } from "@/components/ai/response-style-selector";
import type { FileAttachment } from "@/lib/file-utils";
import React from "react";
import { useChatStatus } from "@ai-sdk-tools/store";
import { useChatUIStore } from "../ui-store";
import { uploadFiles, isSupportedFileType } from "@/lib/file-utils";
import { toast } from "sonner";

interface ChatInputAreaProps {
  disableInput: boolean;
  selectedModel: string;
  orgName?: string;
  onModelChange: (model: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onStop: () => void;
}

export const ChatInputArea = React.memo(function ChatInputArea({
  disableInput,
  selectedModel,
  orgName,
  onModelChange,
  onSubmit,
  onStop,
}: ChatInputAreaProps) {
  const status = useChatStatus();
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
  const responseStyle = useChatUIStore((s) => s.responseStyle);
  const setResponseStyle = useChatUIStore((s) => s.setResponseStyle);
  const setQuotaError = useChatUIStore((s) => s.setQuotaError);
  const setShowNoSubscriptionDialog = useChatUIStore((s) => s.setShowNoSubscriptionDialog);
  const fileUploadError = useChatUIStore((s) => s.fileUploadError);
  const setFileUploadError = useChatUIStore((s) => s.setFileUploadError);
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

  return (
    <div className="absolute bottom-0 left-0 right-0">
      <div className="mx-auto w-full max-w-3xl px-2">
        {/* No Subscription Dialog */}
        <NoSubscriptionDialog
          isOpen={showNoSubscriptionDialog}
          onClose={() => setShowNoSubscriptionDialog(false)}
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
                  Cuota
                  {quotaError.type === "premium" ? " Premium" : " Standard"}{" "}
                  excedida
                </div>
              </div>
              <button
                onClick={() => setQuotaError(null)}
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
          <PromptInputError 
            error={fileUploadError} 
            onDismiss={() => setFileUploadError(null)}
          />
          <PromptInputFilePreview
            files={files}
            onRemoveFile={(index) => {
              const uploadedCount = uploadedAttachments.length;
              if (index < uploadedCount) {
                setUploadedAttachments((prev) => prev.filter((_, i) => i !== index));
              } else {
                const uploadingIndex = index - uploadedCount;
                setUploadingFiles((prev) => prev.filter((_, i) => i !== uploadingIndex));
              }
              setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
              // Clear error when user removes files
              setFileUploadError(null);
            }}
            disabled={disableInput}
          />
          <PromptInputTextarea
            onChange={(e) => {
              setInput(e.target.value);
              // Clear error when user starts typing
              if (fileUploadError) setFileUploadError(null);
            }}
            value={input}
            disabled={disableInput || isUploading}
            placeholder="Escribe tu mensaje..."
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputFileUpload
                ref={fileInputRef}
                onFilesSelected={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  const fileArray = Array.from(files);

                  // Clear previous error
                  setFileUploadError(null);

                  const currentTotal = uploadedAttachments.length + uploadingFiles.length;
                  const newTotal = currentTotal + fileArray.length;
                  if (newTotal > 5) {
                    const remaining = 5 - currentTotal;
                    const errorMsg = remaining <= 0
                      ? "Máximo de 5 archivos permitidos por mensaje"
                      : `Solo puedes agregar ${remaining} más archivo${remaining === 1 ? '' : 's'}. Máximo de 5 archivos permitidos por mensaje.`;
                    toast.error(errorMsg);
                    setFileUploadError(errorMsg);
                    return;
                  }

                  const unsupported = fileArray.filter((f) => !isSupportedFileType(f));
                  if (unsupported.length > 0) {
                    const errorMsg = `Tipos de archivo no soportados: ${unsupported.map((f) => f.name).join(", ")}. Solo se permiten imágenes (JPEG, PNG, GIF, WebP) y PDFs.`;
                    toast.error(errorMsg);
                    setFileUploadError(errorMsg);
                    return;
                  }

                  const oversized = fileArray.filter((f) => f.size > 10 * 1024 * 1024);
                  if (oversized.length > 0) {
                    const errorMsg = `Archivos demasiado grandes: ${oversized.map((f) => f.name).join(", ")}. El tamaño máximo es 10MB por archivo.`;
                    toast.error(errorMsg);
                    setFileUploadError(errorMsg);
                    return;
                  }

                  setSelectedFiles((prev) => [...prev, ...fileArray]);
                  setUploadingFiles((prev) => [
                    ...prev,
                    ...fileArray.map((file) => ({ file, isUploading: true })),
                  ]);

                  (async () => {
                    try {
                      const dt = new DataTransfer();
                      fileArray.forEach((f) => dt.items.add(f));
                      const attachments = await uploadFiles(dt.files);
                      setUploadedAttachments((prev) => [...prev, ...attachments]);
                    } catch (err) {
                      console.error("File upload error:", err);
                      const errorMsg = "Error al subir archivos. Por favor, inténtalo de nuevo.";
                      toast.error(errorMsg);
                      setFileUploadError(errorMsg);
                    } finally {
                      setUploadingFiles((prev) => prev.filter((uf) => !fileArray.includes(uf.file)));
                    }
                  })();
                }}
                disabled={disableInput || isUploading}
              />
              <ResponseStyleSelector
                value={responseStyle}
                onValueChange={setResponseStyle}
                disabled={disableInput}
              />
              <PromptInputButton
                onClick={() => {
                  if (disableInput) return;
                  const currentTotalFiles = uploadedAttachments.length + uploadingFiles.length;
                  if (currentTotalFiles >= 5) {
                    const errorMsg = "Máximo de 5 archivos permitidos por mensaje";
                    toast.error(errorMsg);
                    setFileUploadError(errorMsg);
                    return;
                  }
                  // Clear error when opening file dialog
                  setFileUploadError(null);
                  fileInputRef.current?.click();
                }}
                aria-label="Agregar archivos adjuntos"
                disabled={disableInput || (uploadedAttachments.length + uploadingFiles.length) >= 5}
                title={
                  (uploadedAttachments.length + uploadingFiles.length) >= 5
                    ? "Máximo de 5 archivos permitidos por mensaje"
                    : "Agregar archivos adjuntos"
                }
                className="text-secondary hover:bg-popover-main hover:text-popover-text dark:hover:bg-hover/60"
              >
                <AttachmentsIcon className="size-4" />
              </PromptInputButton>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PromptInputButton
                      onClick={handleSearchToggle}
                      aria-label="Toggle web search"
                      disabled={disableInput}
                      variant={isSearchEnabled ? "default" : "ghost"}
                      className={
                        isSearchEnabled
                          ? "bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                          : "text-secondary hover:bg-popover-main hover:text-popover-text dark:hover:bg-hover/60"
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
        {/* Hidden file input handled by PromptInputFileUpload above via the same ref */}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render when any external prop used by this component changes
  return (
    prevProps.disableInput === nextProps.disableInput &&
    prevProps.selectedModel === nextProps.selectedModel &&
    prevProps.onSubmit === nextProps.onSubmit &&
    prevProps.onStop === nextProps.onStop &&
    prevProps.onModelChange === nextProps.onModelChange &&
    prevProps.orgName === nextProps.orgName
  );
});
