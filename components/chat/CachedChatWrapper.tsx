"use client";

import { useState, useEffect } from "react";
import type { UIMessage } from "@ai-sdk-tools/store";
import ChatInterface from "@/components/chat";
import {
  loadCachedThreadMessages,
  getMemoryCachedThreadMessages,
} from "@/lib/local-first/thread-messages-cache";

interface CachedChatWrapperProps {
  threadId: string;
  customInstructionId?: string;
}

/**
 * Wrapper that handles cache logic for ChatInterface.
 * Provides instant loading via memory cache, with IndexedDB fallback.
 */
export function CachedChatWrapper({ threadId, customInstructionId }: CachedChatWrapperProps) {
  // Sync read from memory cache (instant)
  let memoryCachedMessages: UIMessage[] | undefined;
  let hadMemoryCache = false;
  if (typeof window !== "undefined") {
    const cached = getMemoryCachedThreadMessages(threadId);
    memoryCachedMessages = cached?.messages;
    hadMemoryCache = !!(memoryCachedMessages && memoryCachedMessages.length > 0);
  }

  // Async IndexedDB fallback (only when memory cache is empty)
  const [asyncLoadedMessages, setAsyncLoadedMessages] = useState<UIMessage[] | undefined>(undefined);
  const [asyncLoadedThreadId, setAsyncLoadedThreadId] = useState<string | null>(null);

  useEffect(() => {
    if (hadMemoryCache || asyncLoadedThreadId === threadId) return;

    setAsyncLoadedMessages(undefined);
    let cancelled = false;
    
    void (async () => {
      try {
        const record = await loadCachedThreadMessages(threadId);
        if (cancelled) return;
        setAsyncLoadedMessages(record?.messages);
        setAsyncLoadedThreadId(threadId);
      } catch {
        if (!cancelled) {
          setAsyncLoadedMessages(undefined);
          setAsyncLoadedThreadId(threadId);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [threadId, hadMemoryCache, asyncLoadedThreadId]);

  const initialMessages = memoryCachedMessages ?? 
    (asyncLoadedThreadId === threadId ? asyncLoadedMessages : undefined);

  return (
    <ChatInterface
      key={threadId}
      id={threadId}
      initialMessages={initialMessages}
      customInstructionId={customInstructionId}
    />
  );
}
