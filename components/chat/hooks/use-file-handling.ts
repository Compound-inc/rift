import { useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  uploadFiles,
  isSupportedFileType,
  type FileAttachment
} from "@/lib/file-utils";
import type { UploadingFile } from "../types";

interface UseFileHandlingProps {
  uploadedAttachments: FileAttachment[];
  setUploadedAttachments: (attachments: FileAttachment[] | ((prev: FileAttachment[]) => FileAttachment[])) => void;
  uploadingFiles: UploadingFile[];
  setUploadingFiles: (files: UploadingFile[] | ((prev: UploadingFile[]) => UploadingFile[])) => void;
  selectedFiles: File[];
  setSelectedFiles: (files: File[] | ((prev: File[]) => File[])) => void;
  disableInput: boolean;
}

export function useFileHandling({
  uploadedAttachments,
  setUploadedAttachments,
  uploadingFiles,
  setUploadingFiles,
  selectedFiles,
  setSelectedFiles,
  disableInput,
}: UseFileHandlingProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = useCallback(async (files: File[]): Promise<FileAttachment[]> => {
    if (files.length === 0) return [];
    
    // Add files to uploading state immediately for instant feedback
    const newUploadingFiles: UploadingFile[] = files.map(file => ({ file, isUploading: true }));
    setUploadingFiles((prev: UploadingFile[]) => [...prev, ...newUploadingFiles]);
    
    try {
      const fileList = new DataTransfer();
      files.forEach(file => fileList.items.add(file));
      
      const attachments = await uploadFiles(fileList.files);
      
      // Add to uploaded attachments (using R2 URLs directly)
      setUploadedAttachments((prev: FileAttachment[]) => [...prev, ...attachments]);
      
      // Remove from uploading state
      setUploadingFiles((prev: UploadingFile[]) => prev.filter((uf: UploadingFile) => !files.includes(uf.file)));
      
      return attachments;
    } catch (error) {
      console.error("File upload error:", error);
      toast.error(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Remove from uploading state on error
      setUploadingFiles((prev: UploadingFile[]) => prev.filter((uf: UploadingFile) => !files.includes(uf.file)));
      
      return [];
    }
  }, [setUploadedAttachments, setUploadingFiles]);

  const handleAttachClick = useCallback(() => {
    if (disableInput) return;
    
    // Check if we've reached the file limit
    const currentTotalFiles = uploadedAttachments.length + uploadingFiles.length;
    if (currentTotalFiles >= 5) {
      toast.error("Maximum of 5 files allowed per message");
      return;
    }
    
    fileInputRef.current?.click();
  }, [disableInput, uploadedAttachments.length, uploadingFiles.length]);

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      const fileArray = Array.from(files);
      
      // Check total file count limit (5 files max)
      const currentTotalFiles = uploadedAttachments.length + uploadingFiles.length;
      const newTotalFiles = currentTotalFiles + fileArray.length;
      
      if (newTotalFiles > 5) {
        const remainingSlots = 5 - currentTotalFiles;
        if (remainingSlots <= 0) {
          toast.error("Maximum of 5 files allowed per message");
          return;
        } else {
          toast.error(`You can only add ${remainingSlots} more file${remainingSlots === 1 ? '' : 's'}. Maximum of 5 files allowed per message.`);
          return;
        }
      }
      
      // Validate file types
      const unsupportedFiles = fileArray.filter(file => !isSupportedFileType(file));
      if (unsupportedFiles.length > 0) {
        toast.error(`Unsupported file types: ${unsupportedFiles.map(f => f.name).join(", ")}`);
        return;
      }
      
      // Validate file sizes (10MB limit)
      const oversizedFiles = fileArray.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        toast.error(`Files too large: ${oversizedFiles.map(f => f.name).join(", ")}`);
        return;
      }
      
      // Add to selected files for preview
      setSelectedFiles((prev: File[]) => [...prev, ...fileArray]);
      
      // Upload immediately in background - don't await
      handleFileUpload(fileArray);
    },
    [handleFileUpload, uploadedAttachments.length, uploadingFiles.length, setSelectedFiles],
  );

  const handleRemoveFile = useCallback((index: number) => {
    // Check if it's an uploading file or uploaded attachment
    // Order is: uploadedAttachments first, then uploadingFiles
    const uploadedCount = uploadedAttachments.length;
    
    if (index < uploadedCount) {
      // Remove from uploaded attachments
      setUploadedAttachments((prev: FileAttachment[]) => prev.filter((_: FileAttachment, i: number) => i !== index));
    } else {
      // Remove from uploading files
      const uploadingIndex = index - uploadedCount;
      setUploadingFiles((prev: UploadingFile[]) => prev.filter((_: UploadingFile, i: number) => i !== uploadingIndex));
    }
    
    // Also remove from selected files (this might need adjustment based on your logic)
    setSelectedFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
  }, [uploadedAttachments.length, setUploadedAttachments, setUploadingFiles, setSelectedFiles]);

  return {
    fileInputRef,
    handleFileUpload,
    handleAttachClick,
    handleFilesSelected,
    handleRemoveFile,
  };
}
