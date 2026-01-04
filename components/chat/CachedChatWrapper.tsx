"use client";

import { useState, useEffect } from "react";
import type { UIMessage } from "@ai-sdk-tools/store";
import * as Sentry from "@sentry/nextjs";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import ChatInterface from "@/components/chat";
import { transformConvexMessages } from "@/components/chat/utils/transformConvexMessages";
import {
  loadCachedThreadMessages,
  getMemoryCachedThreadMessages,
  reconcileCacheWithServer,
} from "@/lib/local-first/thread-messages-cache";

interface CachedChatWrapperProps {
  threadId: string;
  customInstructionId?: string;
}

/**
 * Wrapper that handles cache logic for ChatInterface.
 * Provides instant loading via memory cache, with IndexedDB fallback.
 * Performs one-off server fetch and passes fresh data to ChatInterface.
 */
export function CachedChatWrapper({ threadId, customInstructionId }: CachedChatWrapperProps) {
  const convex = useConvex();

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

  // Server messages from one-off fetch
  const [serverMessages, setServerMessages] = useState<UIMessage[] | undefined>(undefined);
  const [serverFetchedThreadId, setServerFetchedThreadId] = useState<string | null>(null);
  const [serverContinueCursor, setServerContinueCursor] = useState<string | null>(null);
  const [serverIsDone, setServerIsDone] = useState<boolean>(true);

  // Load from IndexedDB if memory cache is empty
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
      } catch (error) {
        if (!cancelled) {
          Sentry.captureException(error, {
            tags: {
              error_type: "indexeddb_load_failure",
              operation: "load_cached_thread_messages",
            },
            extra: {
              threadId,
            },
          });
          setAsyncLoadedMessages(undefined);
          setAsyncLoadedThreadId(threadId);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [threadId, hadMemoryCache, asyncLoadedThreadId]);

  // One-off fetch from Convex - provides fresh data and reconciles cache
  useEffect(() => {
    if (serverFetchedThreadId === threadId) return;
    
    // Reset server messages when thread changes
    if (serverFetchedThreadId !== null && serverFetchedThreadId !== threadId) {
      setServerMessages(undefined);
      setServerContinueCursor(null);
      setServerIsDone(true);
    }
    
    let cancelled = false;
    
    void (async () => {
      try {
        const result = await convex.query(api.threads.getThreadMessagesPaginatedSafe, {
          threadId,
          paginationOpts: { numItems: 20, cursor: null },
        });
        
        if (cancelled) return;
        
        const normalizedCursor =
          typeof result.continueCursor === "string" && result.continueCursor.length > 0
            ? result.continueCursor
            : null;
        setServerContinueCursor(normalizedCursor);
        setServerIsDone(!!result.isDone || normalizedCursor === null);

        if (result.page && result.page.length > 0) {
          const messages = transformConvexMessages(result.page);
          setServerMessages(messages);
          await reconcileCacheWithServer(threadId, messages);
        } else {
          setServerMessages([]);
          await reconcileCacheWithServer(threadId, []);
        }
        
        setServerFetchedThreadId(threadId);
      } catch {
        // Silently fail - will use cache
        setServerFetchedThreadId(threadId);
      }
    })();

    return () => { cancelled = true; };
  }, [threadId, convex, serverFetchedThreadId]);

  const initialMessages = memoryCachedMessages ?? 
    (asyncLoadedThreadId === threadId ? asyncLoadedMessages : undefined);

  // Only pass serverMessages if it's for the current thread
  const currentServerMessages = serverFetchedThreadId === threadId ? serverMessages : undefined;
  const currentContinueCursor = serverFetchedThreadId === threadId ? serverContinueCursor : null;
  const currentIsDone = serverFetchedThreadId === threadId ? serverIsDone : true;

  return (
    <ChatInterface
      key={threadId}
      id={threadId}
      initialMessages={initialMessages}
      serverMessages={currentServerMessages}
      initialHistoryCursor={currentContinueCursor}
      initialHistoryIsDone={currentIsDone}
      customInstructionId={customInstructionId}
    />
  );
}
