"use client";

import { useCallback, useRef } from "react";
import type { UIMessage } from "@ai-sdk-tools/store";
import type { RefObject } from "react";

type Role = "user" | "assistant" | "system";

type UseRegenerationParams = {
  setMessages: (updater: (curr: UIMessage[]) => UIMessage[]) => void;
  status: string;
  stop: () => void;
  regenerate: (opts: { messageId: string }) => Promise<void> | void;
};

export function useRegeneration({ setMessages, status, stop, regenerate }: UseRegenerationParams) {
  const regenerateAnchorRef = useRef<{ id: string; role: Role } | null>(null);
  const hiddenIdsRef = useRef<Set<string>>(new Set());

  const pruneAt = useCallback((list: UIMessage[], anchorId: string, role: Role) => {
    const idx = list.findIndex((m) => m.id === anchorId);
    if (idx === -1) return list;
    if (role === "user") return list.slice(0, idx + 1);
    return list.slice(0, idx);
  }, []);

  const handleRegenerateAssistant = useCallback(
    (messageId: string, renderedMessages: UIMessage[]) => {
      const target = renderedMessages.find((m) => m.id === messageId);
      const role = (target?.role ?? "assistant") as Role;
      // Hide the anchor assistant and everything after it from the merged view without mutating hook state
      const idx = renderedMessages.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        const idsToHide = renderedMessages.slice(idx).map((m) => m.id);
        hiddenIdsRef.current = new Set(idsToHide);
      }
      regenerateAnchorRef.current = { id: messageId, role };
      if (status === "streaming") stop();
      // Do not prune hook messages; regenerate needs the target to exist in the store
      (async () => {
        try {
          await regenerate({ messageId });
        } catch (e) {
          // Swallow; caller should toast/log
        }
      })();
    },
    [status, stop, regenerate],
  );

  const handleRegenerateAfterUser = useCallback(
    (messageId: string, renderedMessages: UIMessage[]) => {
      const target = renderedMessages.find((m) => m.id === messageId);
      const role = (target?.role ?? "user") as Role;
      regenerateAnchorRef.current = { id: messageId, role };
      if (status === "streaming") stop();
      // Optimistically prune hook messages for instant UX (keep user msg)
      setMessages((curr: UIMessage[]) => pruneAt(curr, messageId, role));
      (async () => {
        try {
          await regenerate({ messageId });
        } catch (e) {
          // Swallow; caller should toast/log
        }
      })();
    },
    [status, stop, setMessages, pruneAt, regenerate],
  );

  return {
    regenerateAnchorRef,
    hiddenIdsRef,
    pruneAt,
    handleRegenerateAssistant,
    handleRegenerateAfterUser,
  } as const;
}

export function filterHiddenForRender(
  messages: UIMessage[],
  hiddenIdsRef: RefObject<Set<string>>,
): UIMessage[] {
  const hidden = hiddenIdsRef.current;
  if (!hidden || hidden.size === 0) return messages;
  const filtered = messages.filter((m) => !hidden.has(m.id));
  if (filtered.length === messages.length) {
    // All hidden ids are gone from the view; clear the set
    hidden.clear();
  }
  return filtered;
}


