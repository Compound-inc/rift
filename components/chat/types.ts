import type React from "react";
import type { UIMessage } from "@ai-sdk/react";
import type { Preloaded } from "convex/react";
import type { api } from "@/convex/_generated/api";
import type { FileAttachment } from "@/lib/file-utils";

export interface ChatInterfaceProps {
  id: string;
  initialMessages?: UIMessage[];
  disableInput?: boolean;
  onInitialMessage?: (message: UIMessage) => Promise<void>;
  preloadedMessages?: Preloaded<typeof api.threads.getThreadMessagesPaginatedSafe>;
}

export interface QuotaError {
  type: "standard" | "premium";
  message: string;
  currentUsage: number;
  limit: number;
  otherTypeUsage: number;
  otherTypeLimit: number;
}

export interface ConvexMessage {
  messageId: string;
  role: "user" | "assistant" | "system";
  reasoning?: string;
  content?: string;
  attachmentsIds?: string[];
  attachments?: Array<{
    attachmentId: string;
    fileName: string;
    mimeType: string;
    attachmentUrl: string;
    attachmentType: "image" | "pdf" | "file";
  }>;
  sources?: Array<{
    sourceId: string;
    url: string;
    title?: string;
  }>;
}

export type UploadingFile = {
  file: File;
  isUploading: boolean;
};

export interface ChatState {
  input: string;
  selectedFiles: File[];
  uploadedAttachments: FileAttachment[];
  isUploading: boolean;
  uploadingFiles: UploadingFile[];
  isSendingMessage: boolean;
  isSearchEnabled: boolean;
  quotaError: QuotaError | null;
  showNoSubscriptionDialog: boolean;
  chatKey: number;
}

export interface ChatStateSetters {
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setUploadedAttachments: React.Dispatch<React.SetStateAction<FileAttachment[]>>;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
  setUploadingFiles: React.Dispatch<React.SetStateAction<UploadingFile[]>>;
  setIsSendingMessage: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setQuotaError: React.Dispatch<React.SetStateAction<QuotaError | null>>;
  setShowNoSubscriptionDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setChatKey: React.Dispatch<React.SetStateAction<number>>;
}
