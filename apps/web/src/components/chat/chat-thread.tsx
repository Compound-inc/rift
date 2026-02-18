"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { UIMessage } from "ai";
import { useOptimizedScroll } from "@/hooks/use-optimized-scroll";
import { useFirstMessageSendAnimation } from "@/components/chat/first-message-send-animation";
import { MessageRenderer } from "@/components/chat/components/message-renderer";
import { Loader } from "@/components/chat/loader";

const BOTTOM_PADDING_PX = 164;

export type ChatThreadStatus = "submitted" | "streaming" | "ready" | "error";

export interface RiftChatThreadProps {
  messages: UIMessage[];
  status: ChatThreadStatus;
  onRegenerateAssistantMessage: (messageId: string) => void;
  onRegenerateAfterUserMessage: (messageId: string) => void;
  onEditUserMessage?: (messageId: string, newText: string) => Promise<void> | void;
  onResponseReady?: (messageId: string) => void;
  disableRegenerate?: boolean;
  /** When false, skip pin-to-last-user-message during initial thread load. Default true for backward compat. */
  initialLoadComplete?: boolean;
}

export function RiftChatThread({
  messages,
  status,
  onRegenerateAssistantMessage,
  onRegenerateAfterUserMessage,
  onEditUserMessage,
  onResponseReady,
  disableRegenerate = false,
  initialLoadComplete = true,
}: RiftChatThreadProps) {
  const firstMessageAnim = useFirstMessageSendAnimation();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastUserMessageRef = useRef<HTMLDivElement | null>(null);
  const firstUserMessageRef = useRef<HTMLDivElement | null>(null);
  const contentEndRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const lastSpacerHeightRef = useRef<number>(0);
  const localBeginTokenRef = useRef<string | null>(null);
  const didAnimateTokenRef = useRef<string | null>(null);

  const { scrollToBottom, markManualScroll, resetManualScroll } =
    useOptimizedScroll(bottomRef);

  const sorted = useMemo(() => messages.slice(), [messages]);
  const userMessageCount = useMemo(
    () => sorted.filter((m) => m.role === "user").length,
    [sorted],
  );
  const shouldDelayFirstAssistantPlaceholder =
    userMessageCount === 1 && firstMessageAnim.phase === "userAnimating";
  const shouldAutoScroll = userMessageCount > 1;
  const prevUserMessageCountRef = useRef(userMessageCount);
  const lastUserMessageId = useMemo(() => {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i]?.role === "user") return sorted[i]!.id;
    }
    return null;
  }, [sorted]);

  // Animate the very first user message into place when we land on thread after sending from welcome.
  useLayoutEffect(() => {
    const beginToken = firstMessageAnim.consumeBeginToken();
    if (beginToken) localBeginTokenRef.current = beginToken;

    if (localBeginTokenRef.current == null) return;
    if (didAnimateTokenRef.current === localBeginTokenRef.current) return;
    if (firstMessageAnim.phase !== "userAnimating") return;
    if (userMessageCount !== 1) return;
    if (!firstMessageAnim.sourcePoint) return;

    const el = firstUserMessageRef.current;
    if (!el) return;

    // Position viewport so the first user message is at the top (no scrollable space above it).
    el.scrollIntoView({ block: "start", behavior: "auto", inline: "nearest" });

    const easing =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ease-out-expo")
        .trim() || "cubic-bezier(0.16, 1, 0.3, 1)";

    const dest = el.getBoundingClientRect();
    const dx = 0;
    const dy = Math.round(firstMessageAnim.sourcePoint.y - dest.top);

    el.style.willChange = "transform, opacity";
    el.style.opacity = "0";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.getBoundingClientRect();

    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        { transform: "translate(0px, 0px)", opacity: 1 },
      ],
      { duration: 420, easing, fill: "both" },
    );

    didAnimateTokenRef.current = localBeginTokenRef.current;

    anim.finished
      .catch(() => {})
      .finally(() => {
        el.style.willChange = "";
        el.style.opacity = "";
        el.style.transform = "";
        firstMessageAnim.markUserDone();
      });
  }, [
    firstMessageAnim,
    firstMessageAnim.phase,
    firstMessageAnim.sourcePoint,
    userMessageCount,
  ]);

  useEffect(() => {
    if (firstMessageAnim.phase !== "userDone") return;
    if (userMessageCount !== 1) return;
    const hasAssistant = sorted.some((m) => m.role === "assistant");
    if (!hasAssistant) return;

    const t = window.setTimeout(() => firstMessageAnim.reset(), 600);
    return () => window.clearTimeout(t);
  }, [firstMessageAnim, firstMessageAnim.phase, sorted, userMessageCount]);

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

  const getScrollParent = useCallback((node: HTMLElement | null) => {
    let el: HTMLElement | null = node?.parentElement ?? null;
    while (el) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const isScrollableOverflow =
        overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      if (isScrollableOverflow && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  }, []);

  const offsetTopWithin = useCallback((el: HTMLElement, ancestor: HTMLElement) => {
    let top = 0;
    let node: HTMLElement | null = el;
    while (node && node !== ancestor) {
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    if (node !== ancestor) return null;
    return top;
  }, []);

  const recalcSpacer = useCallback(() => {
    const spacerEl = spacerRef.current;
    if (!spacerEl) return;

    // Single user with no assistant, or single user with one assistant (first response): no spacer
    // so there's no scrollable space below and no mismatch when the AI starts responding.
    const oneUser = sorted.filter((m) => m.role === "user").length === 1;
    const hasAssistant = sorted.some((m) => m.role === "assistant");
    const oneUserNoAssistant = oneUser && !hasAssistant;
    const oneUserOneAssistant = oneUser && hasAssistant && sorted.length === 2;
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

    const maxSpacer = Math.max(0, Math.floor(viewportHeight - BOTTOM_PADDING_PX));

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

    if (!Number.isFinite(contentHeightFromAnchorTopToEnd) || contentHeightFromAnchorTopToEnd < 0) {
      contentHeightFromAnchorTopToEnd = 0;
    }

    const next = Math.min(
      maxSpacer,
      Math.max(0, Math.floor(viewportHeight - BOTTOM_PADDING_PX - contentHeightFromAnchorTopToEnd)),
    );

    if (Math.abs(lastSpacerHeightRef.current - next) >= 1) {
      spacerEl.style.height = `${next}px`;
      lastSpacerHeightRef.current = next;
    }
  }, [getScrollParent, offsetTopWithin, sorted]);

  useLayoutEffect(() => {
    recalcSpacer();
  }, [recalcSpacer, messages, status, lastUserMessageId]);

  useLayoutEffect(() => {
    const handle = () => recalcSpacer();

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
  }, [recalcSpacer, lastUserMessageId]);

  // Only pin to last user message when the user just sent one new message (count went up by 1).
  // When we navigate to a thread and messages load later, count can jump from 0 to N — don't pin then.
  // Skip during initial load so messages arriving in two batches don't trigger a second smooth scroll.
  useLayoutEffect(() => {
    const prev = prevUserMessageCountRef.current;
    prevUserMessageCountRef.current = userMessageCount;

    if (!initialLoadComplete) return;
    if (userMessageCount <= 1) return;
    if (userMessageCount !== prev + 1) return;

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
  }, [initialLoadComplete, recalcSpacer, resetManualScroll, scrollToBottom, userMessageCount]);

  const pinToLastUserMessage = useCallback(() => {
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
  }, [recalcSpacer, resetManualScroll, scrollToBottom]);

  const runPinAfterLayout = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(pinToLastUserMessage);
    });
  }, [pinToLastUserMessage]);

  const handleRegenerateAssistantMessage = useCallback(
    (messageId: string) => {
      onRegenerateAssistantMessage(messageId);
      runPinAfterLayout();
    },
    [onRegenerateAssistantMessage, runPinAfterLayout],
  );

  const handleRegenerateAfterUserMessage = useCallback(
    (messageId: string) => {
      onRegenerateAfterUserMessage(messageId);
      runPinAfterLayout();
    },
    [onRegenerateAfterUserMessage, runPinAfterLayout],
  );

  const handleEditUserMessage = useCallback(
    (messageId: string, newText: string): Promise<void> | void => {
      if (!onEditUserMessage) return;
      const result = onEditUserMessage(messageId, newText);
      Promise.resolve(result).then(() => runPinAfterLayout());
      return result;
    },
    [onEditUserMessage, runPinAfterLayout],
  );

  const isStreaming = status === "submitted" || status === "streaming";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        className="flex flex-col pt-9"
        style={{ paddingBottom: BOTTOM_PADDING_PX }}
      >
        {sorted.map((m, index) => {
          const isLastMessage = sorted[sorted.length - 1]?.id === m.id;
          const isUser = m.role === "user";
          const isFirstMessageInList = index === 0;
          const isFirstUserMessageInNewChat =
            isUser && userMessageCount === 1 && firstMessageAnim.phase !== "idle";
          const textParts = m.parts.filter((p) => p.type === "text");
          const markdown = textParts
            .map((p) => (p as { text: string }).text)
            .join("\n\n")
            .trim();
          const isStreamingAssistantPlaceholder =
            m.role === "assistant" &&
            isStreaming &&
            markdown.length === 0 &&
            m.parts.filter((p) => p.type === "file").length === 0;

          const shouldGateFirstAssistantFade =
            m.role === "assistant" &&
            userMessageCount === 1 &&
            firstMessageAnim.phase !== "idle";
          const assistantOpacity =
            shouldGateFirstAssistantFade && firstMessageAnim.phase !== "userDone"
              ? 0
              : 1;

          return (
            <div
              key={m.id}
              ref={
                isFirstUserMessageInNewChat
                  ? firstUserMessageRef
                  : isUser && lastUserMessageId && m.id === lastUserMessageId
                    ? lastUserMessageRef
                    : undefined
              }
              className={[
                "group flex w-full items-end gap-2",
                isUser
                  ? isFirstMessageInList
                    ? "pt-3 pb-4"
                    : "pt-8 pb-4"
                  : isFirstMessageInList
                    ? "pt-3 pb-4"
                    : "py-4",
                isUser ? "is-user" : "is-assistant",
              ].join(" ")}
              style={
                shouldGateFirstAssistantFade
                  ? {
                      opacity: assistantOpacity,
                      transition: "opacity 350ms var(--ease-out-expo)",
                    }
                  : undefined
              }
            >
              <div className="overflow-hidden flex w-full flex-col gap-3 text-[14px] leading-[21px] group-[.is-user]:text-[18px] group-[.is-user]:leading-[27px]">
                {isStreamingAssistantPlaceholder && !shouldDelayFirstAssistantPlaceholder ? (
                  <div className="py-1">
                    <Loader />
                  </div>
                ) : (
                  <MessageRenderer
                    message={m}
                    isStreaming={isLastMessage && isStreaming}
                    onRegenerateAssistantMessage={handleRegenerateAssistantMessage}
                    onRegenerateAfterUserMessage={handleRegenerateAfterUserMessage}
                    onEditUserMessage={handleEditUserMessage}
                    onResponseReady={onResponseReady}
                    disableRegenerate={disableRegenerate}
                    embedInRow
                  />
                )}
              </div>
            </div>
          );
        })}

        {(() => {
          const last = sorted[sorted.length - 1];
          const needsTrailingAssistantRow = isStreaming && (!last || last.role === "user");
          if (!needsTrailingAssistantRow) return null;
          if (shouldDelayFirstAssistantPlaceholder) return null;

          return (
            <div className={["group flex w-full items-end gap-2", "py-4", "is-assistant"].join(" ")}>
              <div className="overflow-hidden flex w-full flex-col gap-3 text-[14px] leading-[21px]">
                <div className="py-1">
                  <Loader />
                </div>
              </div>
            </div>
          );
        })()}

        <div ref={contentEndRef} aria-hidden style={{ height: 0 }} />

        <div ref={spacerRef} aria-hidden style={{ height: 0 }} />

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
