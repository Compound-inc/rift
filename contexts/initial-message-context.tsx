"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { UIMessage } from "ai";

interface InitialMessageContextType {
  setInitialMessage: (threadId: string, message: UIMessage) => void;
  consumeInitialMessage: (threadId: string) => UIMessage | null;
  hasInitialMessage: (threadId: string) => boolean;
}

const InitialMessageContext = createContext<
  InitialMessageContextType | undefined
>(undefined);

const STORAGE_KEY = "initial-messages";
const CLEANUP_DELAY = 5000; // 5 seconds

export function InitialMessageProvider({ children }: { children: ReactNode }) {
  // In-memory storage for active messages
  const messagesRef = useRef<Map<string, UIMessage>>(new Map());
  // Cleanup timers to prevent memory leaks
  const cleanupTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Load from sessionStorage on mount (for page refreshes)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedMessages = JSON.parse(stored) as Record<string, UIMessage>;
        Object.entries(parsedMessages).forEach(([threadId, message]) => {
          messagesRef.current.set(threadId, message);
        });
        // Clear from sessionStorage after loading
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.warn(
        "Failed to load initial messages from sessionStorage:",
        error,
      );
    }
  }, []);

  // Save to sessionStorage before page unload (backup for page refreshes)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (messagesRef.current.size === 0) return;

      const toSave: Record<string, UIMessage> = {};
      messagesRef.current.forEach((message, threadId) => {
        toSave[threadId] = message;
      });

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (error) {
        console.warn(
          "Failed to save initial messages to sessionStorage:",
          error,
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const setInitialMessage = useCallback(
    (threadId: string, message: UIMessage) => {
      // Store the message
      messagesRef.current.set(threadId, message);

      // Clear any existing cleanup timer
      const existingTimer = cleanupTimersRef.current.get(threadId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set a cleanup timer to prevent memory leaks
      const cleanupTimer = setTimeout(() => {
        messagesRef.current.delete(threadId);
        cleanupTimersRef.current.delete(threadId);
      }, CLEANUP_DELAY);

      cleanupTimersRef.current.set(threadId, cleanupTimer);
    },
    [],
  );

  const consumeInitialMessage = useCallback(
    (threadId: string): UIMessage | null => {
      const message = messagesRef.current.get(threadId) || null;

      if (message) {
        // Remove from storage after consumption
        messagesRef.current.delete(threadId);

        // Clear the cleanup timer since we consumed the message
        const timer = cleanupTimersRef.current.get(threadId);
        if (timer) {
          clearTimeout(timer);
          cleanupTimersRef.current.delete(threadId);
        }
      }

      return message;
    },
    [],
  );

  const hasInitialMessage = useCallback((threadId: string): boolean => {
    return messagesRef.current.has(threadId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const cleanupTimers = cleanupTimersRef.current;
    const messages = messagesRef.current;

    return () => {
      cleanupTimers.forEach((timer) => clearTimeout(timer));
      cleanupTimers.clear();
      messages.clear();
    };
  }, []);

  return (
    <InitialMessageContext.Provider
      value={{
        setInitialMessage,
        consumeInitialMessage,
        hasInitialMessage,
      }}
    >
      {children}
    </InitialMessageContext.Provider>
  );
}

export function useInitialMessage() {
  const context = useContext(InitialMessageContext);
  if (context === undefined) {
    throw new Error(
      "useInitialMessage must be used within an InitialMessageProvider",
    );
  }
  return context;
}
