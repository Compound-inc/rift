import { useEffect, useRef, useState } from "react";
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
    try {
      window.dispatchEvent(new Event(RIFT_NAV_EVENT));
    } catch {
      // ignore
    }
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
  const [isHydrated, setIsHydrated] = useState(false);

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
      setSelectedThreadId(fromUrl);
    };

    const onPopState = () => syncFromLocation();
    const onNavEvent = () => syncFromLocation();

    // Mark hydrated once effects are running (prevents `welcome` component flash).
    setIsHydrated(true);

    window.addEventListener("popstate", onPopState);
    window.addEventListener(RIFT_NAV_EVENT, onNavEvent);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(RIFT_NAV_EVENT, onNavEvent);
    };
  }, [setSelectedThreadId]);

  // Write URL when selection changes (in-app thread switching).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasInitializedRef.current) return;

    if (skipNextUrlWriteRef.current) {
      skipNextUrlWriteRef.current = false;
      return;
    }

    const nextPath = pathnameForThreadId(selectedThreadId);
    if (window.location.pathname === nextPath) return;

    window.history.pushState({ threadId: selectedThreadId }, "", nextPath);
  }, [selectedThreadId]);

  return { isHydrated };
}


