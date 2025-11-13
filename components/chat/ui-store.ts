import { create } from "zustand";
import type { ChatState, ChatStateSetters } from "./types";
import type { FileAttachment } from "@/lib/file-utils";
import type { ResponseStyle } from "@/lib/ai/response-styles";

type ChatUIStore = ChatState & ChatStateSetters & {
  handleSearchToggle: () => void;
};

export const useChatUIStore = create<ChatUIStore>((set, get) => ({
  input: "",
  selectedFiles: [],
  uploadedAttachments: [],
  isUploading: false,
  uploadingFiles: [],
  isSendingMessage: false,
  isSearchEnabled: false,
  responseStyle: "regular" as ResponseStyle,
  quotaError: null,
  showNoSubscriptionDialog: false,
  chatKey: 0,
  fileUploadError: null,

  setInput: (value) =>
    set(typeof value === "function" ? (state) => ({ input: value(state.input) }) : { input: value }),
  setSelectedFiles: (value) =>
    set(typeof value === "function" ? (state) => ({ selectedFiles: value(state.selectedFiles) }) : { selectedFiles: value }),
  setUploadedAttachments: (value) =>
    set(
      typeof value === "function"
        ? (state) => ({ uploadedAttachments: value(state.uploadedAttachments as FileAttachment[]) })
        : { uploadedAttachments: value },
    ),
  setIsUploading: (value) =>
    set(typeof value === "function" ? (state) => ({ isUploading: value(state.isUploading) }) : { isUploading: value }),
  setUploadingFiles: (value) =>
    set(
      typeof value === "function"
        ? (state) => ({ uploadingFiles: value(state.uploadingFiles) })
        : { uploadingFiles: value },
    ),
  setIsSendingMessage: (value) =>
    set(
      typeof value === "function"
        ? (state) => ({ isSendingMessage: value(state.isSendingMessage) })
        : { isSendingMessage: value },
    ),
  setIsSearchEnabled: (value) =>
    set(
      typeof value === "function"
        ? (state) => ({ isSearchEnabled: value(state.isSearchEnabled) })
        : { isSearchEnabled: value },
    ),
  setResponseStyle: (value) =>
    set(
      typeof value === "function"
        ? (state) => ({ responseStyle: value(state.responseStyle) })
        : { responseStyle: value },
    ),
  setQuotaError: (value) =>
    set(typeof value === "function" ? (state) => ({ quotaError: value(state.quotaError) }) : { quotaError: value }),
  setShowNoSubscriptionDialog: (value) =>
    set(
      typeof value === "function"
        ? (state) => ({ showNoSubscriptionDialog: value(state.showNoSubscriptionDialog) })
        : { showNoSubscriptionDialog: value },
    ),
  setChatKey: (value) =>
    set(typeof value === "function" ? (state) => ({ chatKey: value(state.chatKey) }) : { chatKey: value }),
  setFileUploadError: (value) =>
    set(typeof value === "function" ? (state) => ({ fileUploadError: value(state.fileUploadError) }) : { fileUploadError: value }),

  handleSearchToggle: () => {
    const next = !get().isSearchEnabled;
    set({ isSearchEnabled: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("webSearchEnabled", next.toString());
    }
  },
}));


