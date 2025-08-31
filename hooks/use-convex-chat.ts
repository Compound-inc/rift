import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Hook for comprehensive thread operations
export function useConvexThreads() {
  const createThread = useMutation(api.threads.createThread);
  const renameThread = useMutation(api.threads.renameThread);
  const deleteThread = useMutation(api.threads.deleteThread);

  return {
    createThread,
    renameThread,
    deleteThread,
  };
}

// Hook for message operations
export function useMessageOperations() {
  const sendMessage = useMutation(api.threads.sendMessage);
  const startAssistantMessage = useMutation(api.threads.startAssistantMessage);
  const appendAssistantMessageDelta = useMutation(api.threads.appendAssistantMessageDelta);
  const finalizeAssistantMessage = useMutation(api.threads.finalizeAssistantMessage);

  return {
    sendMessage,
    startAssistantMessage,
    appendAssistantMessageDelta,
    finalizeAssistantMessage,
  };
}

// Main hook that combines all functionality
export function useConvexChat() {
  const threads = useConvexThreads();
  const messageOps = useMessageOperations();

  return {
    // Thread operations
    createThread: threads.createThread,
    renameThread: threads.renameThread,
    deleteThread: threads.deleteThread,
    
    // Message operations
    sendMessage: messageOps.sendMessage,
    startAssistantMessage: messageOps.startAssistantMessage,
    appendAssistantMessageDelta: messageOps.appendAssistantMessageDelta,
    finalizeAssistantMessage: messageOps.finalizeAssistantMessage,
  };
}

// Individual hooks for specific operations
export function useCreateThread() {
  return useMutation(api.threads.createThread);
}

export function useRenameThread() {
  return useMutation(api.threads.renameThread);
}

export function useDeleteThread() {
  return useMutation(api.threads.deleteThread);
}

export function useSendMessage() {
  return useMutation(api.threads.sendMessage);
}

export function useStartAssistantMessage() {
  return useMutation(api.threads.startAssistantMessage);
}

export function useAppendAssistantMessageDelta() {
  return useMutation(api.threads.appendAssistantMessageDelta);
}

export function useFinalizeAssistantMessage() {
  return useMutation(api.threads.finalizeAssistantMessage);
}

// Note: For queries, use the hooks directly in your components:
// const threadInfo = useQuery(api.threads.getThreadInfo, { threadId });
// const messages = usePaginatedQuery(api.threads.getThreadMessagesPaginated, { threadId, paginationOpts: { numItems: 20, cursor: null } }, { initialNumItems: 20 });
// const threads = usePaginatedQuery(api.threads.getUserThreadsPaginated, { paginationOpts: { numItems: 50, cursor: null } }, { initialNumItems: 50 });
