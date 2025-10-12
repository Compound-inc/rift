import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ChatState, ChatStateSetters, UploadingFile } from "../types";
import type { FileAttachment } from "@/lib/file-utils";

export function useChatState() {
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<FileAttachment[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState<boolean>(false);
  const [quotaError, setQuotaError] = useState<{
    type: "standard" | "premium";
    message: string;
    currentUsage: number;
    limit: number;
    otherTypeUsage: number;
    otherTypeLimit: number;
  } | null>(null);
  const [showNoSubscriptionDialog, setShowNoSubscriptionDialog] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  // Initialize search state from localStorage when model changes
  const handleSearchToggle = useCallback(() => {
    const newSearchState = !isSearchEnabled;
    setIsSearchEnabled(newSearchState);

    // Save to localStorage (client side only)
    if (typeof window !== "undefined") {
      localStorage.setItem("webSearchEnabled", newSearchState.toString());
    }
  }, [isSearchEnabled]);

  const state: ChatState = {
    input,
    selectedFiles,
    uploadedAttachments,
    isUploading,
    uploadingFiles,
    isSendingMessage,
    isSearchEnabled,
    quotaError,
    showNoSubscriptionDialog,
    chatKey,
  };

  const setters: ChatStateSetters = {
    setInput,
    setSelectedFiles,
    setUploadedAttachments,
    setIsUploading,
    setUploadingFiles,
    setIsSendingMessage,
    setIsSearchEnabled,
    setQuotaError,
    setShowNoSubscriptionDialog,
    setChatKey,
  };

  return {
    state,
    setters,
    handleSearchToggle,
  };
}

export function useModelChangeEffect(
  selectedModel: string,
  setChatKey: React.Dispatch<React.SetStateAction<number>>,
  setQuotaError: (error: any) => void,
  setShowNoSubscriptionDialog: (show: boolean) => void,
  setIsSearchEnabled: (enabled: boolean) => void
) {
  const prevModelRef = useRef(selectedModel);

  useEffect(() => {
    if (prevModelRef.current !== selectedModel) {
      prevModelRef.current = selectedModel;
      setChatKey((prev: number) => prev + 1);
      // Clear quota error and dialog when switching models
      setQuotaError(null);
      setShowNoSubscriptionDialog(false);
    }
  }, [selectedModel, setChatKey, setQuotaError, setShowNoSubscriptionDialog]);

  // Initialize search state from localStorage when model changes
  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window !== "undefined") {
      const savedSearchState = localStorage.getItem("webSearchEnabled");
      const searchEnabled = savedSearchState === "true";
      setIsSearchEnabled(searchEnabled);
    }
  }, [selectedModel, setIsSearchEnabled]);
}
