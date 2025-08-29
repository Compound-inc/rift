import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Hook for thread operations
export function useConvexThreads() {
  const createThread = useMutation(api.threads.createThread);

  return {
    createThread,
  };
}

// TODO: Add more thread operations as we build them out
// - getThreads
// - updateThread
// - deleteThread
// - pinThread
// - archiveThread

// TODO: Add message operations as we build them out
// - saveMessage
// - getMessages
// - deleteMessage
// - updateMessage

// TODO: Add AI-related operations as we build them out
// - generateResponse
// - storePausedMessages
// - createOrGetChat
