import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useOptimizedScroll } from "./use-optimized-scroll";

export type UsePinToLastUserMessageOptions = {
  resetKey?: string | number;
  userMessageCount: number;
  lastUserMessageId: string | null;
  /** Passed for effect deps so spacer recalculates when messages or status change. */
  messages: readonly unknown[];
  status?: string;
  bottomPaddingPx?: number;
};

const DEFAULT_BOTTOM_PADDING_PX = 120;

export function usePinToLastUserMessage(
  options: UsePinToLastUserMessageOptions
) {
  const {
    resetKey,
    userMessageCount,
    lastUserMessageId,
    messages,
    status,
    bottomPaddingPx = DEFAULT_BOTTOM_PADDING_PX,
  } = options;

  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);
  const contentEndRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastSpacerHeightRef = useRef<number>(0);
  const prevUserMessageCountRef = useRef(userMessageCount);
  const hasInitialAlignmentRef = useRef(false);
  const lastResetKeyRef = useRef<string | number | undefined>(resetKey);
  const initialSettleUntilRef = useRef(0);

  const { scrollToBottom, markManualScroll, resetManualScroll } =
    useOptimizedScroll(bottomRef);

  const shouldAutoScroll = userMessageCount > 1;

  const getScrollParent = useCallback((node: HTMLElement | null) => {
    let el: HTMLElement | null = node?.parentElement ?? null;
    let fallback: HTMLElement | null = null;
    while (el) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const isScrollableOverflow =
        overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      if (isScrollableOverflow) {
        if (el.scrollHeight > el.clientHeight) return el;
        if (fallback === null) fallback = el;
      }
      el = el.parentElement;
    }
    return fallback;
  }, []);

  const offsetTopWithin = useCallback(
    (el: HTMLElement, ancestor: HTMLElement) => {
      let top = 0;
      let node: HTMLElement | null = el;
      while (node && node !== ancestor) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      if (node !== ancestor) return null;
      return top;
    },
    []
  );

  const recalcSpacer = useCallback(() => {
    const spacerEl = spacerRef.current;
    if (!spacerEl) return;

    // Single user with no assistant, or single user with one assistant (first response): no spacer
    // so there's no scrollable space below and no mismatch when the AI starts responding.
    const oneUser = userMessageCount === 1;
    const hasAssistant = (messages as Array<{ role?: string }>).some(
      (m) => m.role === "assistant"
    );
    const oneUserNoAssistant = oneUser && !hasAssistant;
    const oneUserOneAssistant =
      oneUser && hasAssistant && messages.length === 2;
    if (oneUserNoAssistant || oneUserOneAssistant) {
      spacerEl.style.height = "0px";
      lastSpacerHeightRef.current = 0;
      return;
    }

    const anchorEl = lastUserMessageRef.current;
    const endEl = contentEndRef.current;
    if (!anchorEl || !endEl) {
      spacerEl.style.height = "0px";
      lastSpacerHeightRef.current = 0;
      return;
    }

    const scrollParent = getScrollParent(endEl);
    const viewportHeight =
      scrollParent?.clientHeight ??
      window.visualViewport?.height ??
      window.innerHeight;

    const maxSpacer = Math.max(
      0,
      Math.floor(viewportHeight - bottomPaddingPx)
    );

    let contentHeightFromAnchorTopToEnd = 0;
    if (scrollParent) {
      const anchorTop = offsetTopWithin(anchorEl, scrollParent);
      const endTop = offsetTopWithin(endEl, scrollParent);
      if (anchorTop != null && endTop != null) {
        contentHeightFromAnchorTopToEnd = endTop - anchorTop;
      } else {
        const a = anchorEl.getBoundingClientRect();
        const b = endEl.getBoundingClientRect();
        contentHeightFromAnchorTopToEnd = b.top - a.top;
      }
    } else {
      const a = anchorEl.getBoundingClientRect();
      const b = endEl.getBoundingClientRect();
      contentHeightFromAnchorTopToEnd = b.top - a.top;
    }

    if (
      !Number.isFinite(contentHeightFromAnchorTopToEnd) ||
      contentHeightFromAnchorTopToEnd < 0
    ) {
      contentHeightFromAnchorTopToEnd = 0;
    }

    const next = Math.min(
      maxSpacer,
      Math.max(
        0,
        Math.floor(
          viewportHeight - bottomPaddingPx - contentHeightFromAnchorTopToEnd
        )
      )
    );

    if (Math.abs(lastSpacerHeightRef.current - next) >= 1) {
      spacerEl.style.height = `${next}px`;
      lastSpacerHeightRef.current = next;
    }
  }, [
    getScrollParent,
    offsetTopWithin,
    bottomPaddingPx,
    userMessageCount,
    messages,
  ]);

  const scrollParentToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const node = bottomRef.current ?? contentEndRef.current;
      const scrollParent = getScrollParent(node);
      if (!scrollParent) return false;
      scrollParent.scrollTo({
        top: scrollParent.scrollHeight,
        behavior,
      });
      return true;
    },
    [getScrollParent]
  );

  useLayoutEffect(() => {
    recalcSpacer();
  }, [recalcSpacer, messages, status, lastUserMessageId]);

  useLayoutEffect(() => {
    const handle = () => {
      recalcSpacer();
      if (Date.now() < initialSettleUntilRef.current) {
        if (!scrollParentToBottom("auto")) {
          scrollToBottom("auto");
        }
      }
    };

    const endEl = contentEndRef.current;
    if (!endEl) return;

    const ro = new ResizeObserver(handle);
    ro.observe(endEl);

    const anchorEl = lastUserMessageRef.current;
    if (anchorEl) ro.observe(anchorEl);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", handle);
    vv?.addEventListener("scroll", handle);
    window.addEventListener("resize", handle);

    return () => {
      ro.disconnect();
      vv?.removeEventListener("resize", handle);
      vv?.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, [recalcSpacer, scrollParentToBottom, scrollToBottom, lastUserMessageId]);

  useLayoutEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    hasInitialAlignmentRef.current = false;
    initialSettleUntilRef.current = 0;
    prevUserMessageCountRef.current = userMessageCount;
  }, [resetKey, userMessageCount]);

  useLayoutEffect(() => {
    if (hasInitialAlignmentRef.current) return;
    if (messages.length === 0) {
      prevUserMessageCountRef.current = userMessageCount;
      return;
    }

    resetManualScroll();
    recalcSpacer();
    if (!scrollParentToBottom("auto")) {
      scrollToBottom("auto");
    }
    hasInitialAlignmentRef.current = true;
    initialSettleUntilRef.current = Date.now() + 900;
    requestAnimationFrame(() => {
      if (!scrollParentToBottom("auto")) {
        scrollToBottom("auto");
      }
      requestAnimationFrame(() => {
        if (!scrollParentToBottom("auto")) {
          scrollToBottom("auto");
        }
      });
    });
    prevUserMessageCountRef.current = userMessageCount;
  }, [
    messages.length,
    recalcSpacer,
    scrollParentToBottom,
    resetManualScroll,
    scrollToBottom,
    userMessageCount,
  ]);

  useLayoutEffect(() => {
    const prev = prevUserMessageCountRef.current;
    prevUserMessageCountRef.current = userMessageCount;

    if (!hasInitialAlignmentRef.current) return;
    if (userMessageCount <= 1) return;
    if (userMessageCount <= prev) return;

    resetManualScroll();
    recalcSpacer();
    if (lastUserMessageRef.current) {
      lastUserMessageRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      scrollToBottom();
    }
  }, [
    recalcSpacer,
    resetManualScroll,
    scrollToBottom,
    userMessageCount,
  ]);

  useEffect(() => {
    if (!shouldAutoScroll) return;
    const handleManualScroll = () => markManualScroll();
    window.addEventListener("wheel", handleManualScroll);
    window.addEventListener("touchmove", handleManualScroll);
    return () => {
      window.removeEventListener("wheel", handleManualScroll);
      window.removeEventListener("touchmove", handleManualScroll);
    };
  }, [markManualScroll, shouldAutoScroll]);

  return {
    lastUserMessageRef,
    contentEndRef,
    spacerRef,
    bottomRef,
  };
}
