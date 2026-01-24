import { useEffect, useRef } from "react";
import { useSelectedThreadStore } from "@/lib/stores/selected-thread-store";

declare global {
  interface Window {
    __riftSelectedThreadHistoryPatched?: boolean;
  }
}

const RIFT_NAV_EVENT = "rift:navigation";

function ensureHistoryPatched() {
  if (typeof window === "undefined") return;
  if (window.__riftSelectedThreadHistoryPatched) return;
  window.__riftSelectedThreadHistoryPatched = true;

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  const dispatch = () => {
    // Defer to avoid triggering state updates during useInsertionEffect or render
    queueMicrotask(() => {
      try {
        window.dispatchEvent(new Event(RIFT_NAV_EVENT));
      } catch {
        // ignore
      }
    });
  };

  window.history.pushState = ((data: any, unused: string, url?: string | URL | null) => {
    originalPushState(data, unused, url as any);
    dispatch();
  }) as any;

  window.history.replaceState = ((data: any, unused: string, url?: string | URL | null) => {
    originalReplaceState(data, unused, url as any);
    dispatch();
  }) as any;
}

function parseThreadIdFromPathname(pathname: string): string | null {
  // Supported:
  // - /chat
  // - /chat/<threadId>
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "chat") return null;
  if (parts.length === 2 && parts[0] === "chat") return parts[1] || null;
  return null;
}

function pathnameForThreadId(threadId: string | null): string {
  return threadId ? `/chat/${threadId}` : "/chat";
}

export function useSelectedThreadUrlSync() {
  const selectedThreadId = useSelectedThreadStore((s) => s.selectedThreadId);
  const setSelectedThreadId = useSelectedThreadStore((s) => s.setSelectedThreadId);

  const skipNextUrlWriteRef = useRef(false);
  const hasInitializedRef = useRef(false);
  // Store setSelectedThreadId in ref to avoid re-subscribing event listeners
  // when the function reference changes (following best practice 8.1)
  const setSelectedThreadIdRef = useRef(setSelectedThreadId);

  // Keep ref updated with latest function
  useEffect(() => {
    setSelectedThreadIdRef.current = setSelectedThreadId;
  }, [setSelectedThreadId]);

  // Initialize store from current URL + keep in sync on back/forward.
  useEffect(() => {
    if (typeof window === "undefined") return;

    ensureHistoryPatched();

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Store initializes from window.location in the zustand initializer.
      // Mark initialized and prevent immediate URL writes triggered by that first render.
      skipNextUrlWriteRef.current = true;
    }

    const syncFromLocation = () => {
      const fromUrl = parseThreadIdFromPathname(window.location.pathname);
      skipNextUrlWriteRef.current = true;
      // Use ref to access latest setSelectedThreadId without re-subscribing
      setSelectedThreadIdRef.current(fromUrl);
    };

    const onPopState = () => syncFromLocation();
    const onNavEvent = () => syncFromLocation();

    window.addEventListener("popstate", onPopState);
    window.addEventListener(RIFT_NAV_EVENT, onNavEvent);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(RIFT_NAV_EVENT, onNavEvent);
    };
    // Empty deps: event listeners are stable, setSelectedThreadId accessed via ref
  }, []);

  // Write URL when selection changes (in-app thread switching).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasInitializedRef.current) return;

    const nextPath = pathnameForThreadId(selectedThreadId);
    const currentPath = window.location.pathname;
    
    // If we're already at the correct path, no update needed
    if (currentPath === nextPath) {
      // Reset skip flag if it was set, since we're in sync
      if (skipNextUrlWriteRef.current) {
        skipNextUrlWriteRef.current = false;
      }
      return;
    }

    // If skipNextUrlWriteRef is set, it means we're syncing from a URL change.
    // However, if the selectedThreadId doesn't match the current URL, we need to update.
    // This handles the case where setSelectedThreadId is called directly (e.g., "Nuevo Chat" button).
    if (skipNextUrlWriteRef.current) {
      const currentUrlThreadId = parseThreadIdFromPathname(currentPath);
      // If the store state doesn't match the current URL, we need to update the URL
      // This ensures URL updates when clicking "Nuevo Chat" even if skipNextUrlWriteRef is set
      if (currentUrlThreadId === selectedThreadId) {
        // They match, so this was a URL-initiated change - skip the write
        skipNextUrlWriteRef.current = false;
        return;
      }
      // They don't match - this is a programmatic change, so update the URL
      skipNextUrlWriteRef.current = false;
    }

    // Use replaceState for navigation to /chat (welcome page) to avoid unnecessary history entries
    // Use pushState for thread selection to allow back button navigation
    if (selectedThreadId === null) {
      window.history.replaceState({ threadId: selectedThreadId }, "", nextPath);
    } else {
      window.history.pushState({ threadId: selectedThreadId }, "", nextPath);
    }
  }, [selectedThreadId]);
}


