import { useEffect, useRef } from "react";
import { useSelectedThreadStore } from "@/lib/stores/selected-thread-store";
import { useLocale } from "@/contexts/locale-context";

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

const LOCALES = ["en", "es"] as const;

function parseThreadIdFromPathname(pathname: string): string | null {
  // Supported: /chat, /chat/<id>, /[lang]/chat, /[lang]/chat/<id>
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "chat") return null;
  if (parts.length === 2 && parts[0] === "chat") return parts[1] || null;
  if (parts.length === 2 && LOCALES.includes(parts[0] as any) && parts[1] === "chat") return null;
  if (parts.length === 3 && LOCALES.includes(parts[0] as any) && parts[1] === "chat") return parts[2] || null;
  return null;
}

function pathnameForThreadId(threadId: string | null, lang: string): string {
  const base = `/${lang}/chat`;
  return threadId ? `${base}/${threadId}` : base;
}

export function useSelectedThreadUrlSync() {
  const lang = useLocale();
  const selectedThreadId = useSelectedThreadStore((s) => s.selectedThreadId);
  const setSelectedThreadId = useSelectedThreadStore((s) => s.setSelectedThreadId);

  const skipNextUrlWriteRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const setSelectedThreadIdRef = useRef(setSelectedThreadId);

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
  }, []);

  // Write URL when selection changes (in-app thread switching).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasInitializedRef.current) return;

    const nextPath = pathnameForThreadId(selectedThreadId, lang);
    const currentPath = window.location.pathname;
    
    if (currentPath === nextPath) {
      if (skipNextUrlWriteRef.current) {
        skipNextUrlWriteRef.current = false;
      }
      return;
    }

    if (skipNextUrlWriteRef.current) {
      const currentUrlThreadId = parseThreadIdFromPathname(currentPath);
      if (currentUrlThreadId === selectedThreadId) {
        skipNextUrlWriteRef.current = false;
        return;
      }
      skipNextUrlWriteRef.current = false;
    }

    if (selectedThreadId === null) {
      window.history.replaceState({ threadId: selectedThreadId }, "", nextPath);
    } else {
      window.history.pushState({ threadId: selectedThreadId }, "", nextPath);
    }
  }, [selectedThreadId, lang]);
}


