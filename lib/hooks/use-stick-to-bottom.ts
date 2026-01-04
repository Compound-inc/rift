"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export interface UseStickToBottomOptions {
  /** Offset in pixels from bottom to consider "at bottom". @default 50 */
  offset?: number;
}

export interface UseStickToBottomReturn {
  scrollRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  isAtBottom: boolean;
  scrollToBottom: (behavior?: "instant" | "smooth") => void;
  markInitialScrollDone: () => void;
  reset: () => void;
}

const DEFAULT_OFFSET = 50;

/**
 * Hook for stick-to-bottom behavior in chat interfaces.
 * - Instant scroll on initial load
 * - Smooth scroll during streaming
 * - Escape detection when user scrolls up
 */
export function useStickToBottom(
  options: UseStickToBottomOptions = {}
): UseStickToBottomReturn {
  const { offset = DEFAULT_OFFSET } = options;

  const scrollRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [escapedFromLock, setEscapedFromLock] = useState(false);

  // Refs to avoid recreating ResizeObserver on state changes
  const isAtBottomRef = useRef(true);
  const escapedFromLockRef = useRef(false);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
    escapedFromLockRef.current = escapedFromLock;
  }, [isAtBottom, escapedFromLock]);

  const lastScrollTopRef = useRef<number>(0);
  const isProgrammaticScrollRef = useRef(false);
  const initialScrollDoneRef = useRef(false);
  // Delay smooth auto-scroll during initial mount / heavy content layout (markdown, code blocks, etc.).
  // Prevents the "jump up then smooth down" effect on first load.
  const smoothEnabledAtRef = useRef<number>(0);
  const AUTO_SMOOTH_DELAY_MS = 800;

  const checkIsAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= offset;
  }, [offset]);

  const markInitialScrollDone = useCallback(() => {
    initialScrollDoneRef.current = true;
    smoothEnabledAtRef.current = Date.now() + AUTO_SMOOTH_DELAY_MS;
  }, []);

  const reset = useCallback(() => {
    initialScrollDoneRef.current = false;
    smoothEnabledAtRef.current = Date.now() + AUTO_SMOOTH_DELAY_MS;
    setIsAtBottom(true);
    setEscapedFromLock(false);
  }, []);

  const scrollToBottom = useCallback((behavior: "instant" | "smooth" = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;

    isProgrammaticScrollRef.current = true;
    setEscapedFromLock(false);
    setIsAtBottom(true);

    const target = el.scrollHeight - el.clientHeight;

    if (behavior === "instant") {
      el.scrollTop = target;
      lastScrollTopRef.current = target;
      isProgrammaticScrollRef.current = false;
    } else {
      el.scrollTo({ top: target, behavior: "smooth" });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        lastScrollTopRef.current = el.scrollTop;
      }, 500);
    }
  }, []);

  // Scroll event handler for escape detection
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        lastScrollTopRef.current = el.scrollTop;
        return;
      }

      const current = el.scrollTop;
      const isScrollingUp = current < lastScrollTopRef.current;
      const atBottom = checkIsAtBottom();

      if (isScrollingUp && !atBottom) {
        setEscapedFromLock(true);
        setIsAtBottom(false);
      } else if (atBottom) {
        setEscapedFromLock(false);
        setIsAtBottom(true);
      }

      lastScrollTopRef.current = current;
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && !isProgrammaticScrollRef.current && !checkIsAtBottom()) {
        setEscapedFromLock(true);
        setIsAtBottom(false);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    el.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("wheel", handleWheel);
    };
  }, [checkIsAtBottom]);

  // ResizeObserver for auto-scroll on content growth
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    let prevHeight = contentEl.offsetHeight;

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      const grew = height > prevHeight;
      const shrank = height < prevHeight;
      prevHeight = height;

      // Keep pinned to bottom when content changes size, as long as the user hasn't escaped the lock.
      if ((grew || shrank) && isAtBottomRef.current && !escapedFromLockRef.current) {
        const now = Date.now();
        const canSmooth =
          grew &&
          initialScrollDoneRef.current &&
          now >= smoothEnabledAtRef.current;
        scrollToBottom(canSmooth ? "smooth" : "instant");
      }
    });

    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  return {
    scrollRef,
    contentRef,
    isAtBottom,
    scrollToBottom,
    markInitialScrollDone,
    reset,
  };
}
