"use client";

import { useCallback, useRef } from "react";
import type { UIMessage } from "@ai-sdk-tools/store";
import type { RefObject } from "react";
import { Data, Effect, Fiber, Schedule } from "effect";

type Role = "user" | "assistant" | "system";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error during message regeneration.
 */
export class RegenerationError extends Data.TaggedError("RegenerationError")<{
  readonly message: string;
  readonly messageId: string;
  readonly cause?: unknown;
}> {}

/**
 * Error during message editing.
 */
export class EditError extends Data.TaggedError("EditError")<{
  readonly message: string;
  readonly messageId: string;
  readonly cause?: unknown;
}> {}

// ============================================================================
// Retry Schedule - exponential backoff with jitter
// ============================================================================

const retrySchedule = Schedule.exponential("500 millis").pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(2)) // Max 2 retries (3 total attempts)
);

// ============================================================================
// Hook
// ============================================================================

type UseRegenerationParams = {
  setMessages: (updater: (curr: UIMessage[]) => UIMessage[]) => void;
  status: string;
  stop: () => void;
  regenerate: (opts: { messageId: string }) => Promise<void> | void;
  onError?: (error: RegenerationError | EditError) => void;
};

export function useRegeneration({
  setMessages,
  status,
  stop,
  regenerate,
  onError,
}: UseRegenerationParams) {
  const regenerateAnchorRef = useRef<{ id: string; role: Role } | null>(null);
  // Track current fiber for cancellation
  const currentFiberRef = useRef<Fiber.RuntimeFiber<void, RegenerationError> | null>(null);
  const pruneAt = useCallback(
    (list: UIMessage[], anchorId: string, role: Role) => {
      const idx = list.findIndex((m) => m.id === anchorId);
      if (idx === -1) return list;
      if (role === "user") return list.slice(0, idx + 1);
      return list.slice(0, idx);
    },
    []
  );

  // Create regeneration effect with retry
  const createRegenerateEffect = useCallback(
    (messageId: string): Effect.Effect<void, RegenerationError> =>
      Effect.tryPromise({
        try: () => Promise.resolve(regenerate({ messageId })),
        catch: (error) =>
          new RegenerationError({
            message: "Regeneration failed",
            messageId,
            cause: error,
          }),
      }).pipe(
        Effect.retry(retrySchedule),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            console.error("Regeneration failed after retries:", error);
            onError?.(error);
            return yield* Effect.fail(error);
          })
        )
      ),
    [regenerate, onError]
  );

  // Run regeneration with automatic cancellation of previous
  const runRegenerationWithCancellation = useCallback(
    (messageId: string) => {
      // Cancel previous if still running
      const previousFiber = currentFiberRef.current;
      if (previousFiber) {
        Effect.runFork(Fiber.interrupt(previousFiber));
      }

      const program = Effect.gen(function* () {
        const fiber = yield* Effect.fork(createRegenerateEffect(messageId));
        currentFiberRef.current = fiber;
        
        // Wait for completion, ignoring interruption
        yield* Fiber.join(fiber).pipe(
          Effect.catchAll(() => Effect.void)
        );
        
        // Clear ref when done
        if (currentFiberRef.current === fiber) {
          currentFiberRef.current = null;
        }
      });

      Effect.runFork(program);
    },
    [createRegenerateEffect]
  );

  const handleRegenerateAssistant = useCallback(
    (messageId: string, renderedMessages: UIMessage[]) => {
      // Find the message index
      const idx = renderedMessages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;

      // Find the preceding user message to trigger regeneration from
      // We search backwards from the assistant message
      let userMessageId = null;
      for (let i = idx - 1; i >= 0; i--) {
        if (renderedMessages[i].role === "user") {
          userMessageId = renderedMessages[i].id;
          break;
        }
      }

      if (!userMessageId) {
        console.error("Could not find preceding user message for regeneration");
        return;
      }

      // Use the user message ID for the anchor and pruning
      const role = "user"; // We are effectively regenerating from the user's perspective

      // Force re-render with pruning at the user message (keeping the user message)
      // Important: `regenerate()` (from the AI SDK store) can throw "message <id> not found"
      // if the anchor message doesn't exist in its internal `messages` array yet.
      // This can happen in our app because `renderedMessages` can include server history
      // that isn't currently in the hook store. If so, sync from `renderedMessages`.
      setMessages((curr) => {
        const source = curr.some((m) => m.id === userMessageId) ? curr : renderedMessages;
        return pruneAt(source, userMessageId, role);
      });
      regenerateAnchorRef.current = { id: userMessageId, role };

      if (status === "streaming") stop();

      runRegenerationWithCancellation(userMessageId);
    },
    [status, stop, setMessages, runRegenerationWithCancellation, pruneAt]
  );

  const handleRegenerateAfterUser = useCallback(
    (messageId: string, renderedMessages: UIMessage[]) => {
      const target = renderedMessages.find((m) => m.id === messageId);
      const role = (target?.role ?? "user") as Role;

      regenerateAnchorRef.current = { id: messageId, role };

      if (status === "streaming") stop();

      // Optimistic prune
      // ensure the anchor exists in the hook store before we call `regenerate()`.
      setMessages((curr) => {
        const source = curr.some((m) => m.id === messageId) ? curr : renderedMessages;
        return pruneAt(source, messageId, role);
      });

      runRegenerationWithCancellation(messageId);
    },
    [status, stop, setMessages, pruneAt, runRegenerationWithCancellation]
  );

  const handleEditUserMessage = useCallback(
    async (
      messageId: string,
      newContent: string,
      renderedMessages: UIMessage[],
      persistEdit: (messageId: string, newContent: string) => Promise<void>
    ) => {
      const program = Effect.gen(function* () {
        // Persist edit first
        yield* Effect.tryPromise({
          try: () => persistEdit(messageId, newContent),
          catch: (error) =>
            new EditError({
              message: "Failed to persist edit",
              messageId,
              cause: error,
            }),
        });

        // Setup regeneration state
        const target = renderedMessages.find((m) => m.id === messageId);
        const role = (target?.role ?? "user") as Role;
        regenerateAnchorRef.current = { id: messageId, role };

        if (status === "streaming") stop();
        // Ensure anchor exists in the hook store; otherwise `regenerate()` may throw.
        setMessages((curr) => {
          const source = curr.some((m) => m.id === messageId) ? curr : renderedMessages;
          return pruneAt(source, messageId, role);
        });

        // Regenerate with retry
        yield* Effect.tryPromise({
          try: () => Promise.resolve(regenerate({ messageId })),
          catch: (error) =>
            new RegenerationError({
              message: "Regeneration after edit failed",
              messageId,
              cause: error,
            }),
        }).pipe(Effect.retry(retrySchedule));
      }).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            console.error("Edit and regenerate failed:", error);
            onError?.(error);
          })
        ),
        Effect.catchAll(() => Effect.void)
      );

      await Effect.runPromise(program);
    },
    [status, stop, setMessages, pruneAt, regenerate, onError]
  );

  // Cancel current regeneration
  const cancelCurrentRegeneration = useCallback(() => {
    const fiber = currentFiberRef.current;
    if (fiber) {
      Effect.runFork(Fiber.interrupt(fiber));
      currentFiberRef.current = null;
    }
  }, []);

  return {
    regenerateAnchorRef,
    pruneAt,
    handleRegenerateAssistant,
    handleRegenerateAfterUser,
    handleEditUserMessage,
    cancelCurrentRegeneration,
  } as const;
}


