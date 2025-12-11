import { Cause, Effect, Option } from "effect";
import type { UIMessage } from "@ai-sdk-tools/store";
import { AbortError, MessageSubmitError, type ChatError } from "../errors";

const isChatError = (error: unknown): error is ChatError =>
  Boolean(
    error &&
      typeof error === "object" &&
      "_tag" in (error as { _tag?: unknown }) &&
      typeof (error as { _tag?: unknown })._tag === "string",
  );

const asAbortError = (error: unknown): AbortError | null => {
  if (isChatError(error) && error._tag === "AbortError") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === "AbortError"
  ) {
    const message =
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Request was cancelled";
    return new AbortError({ message });
  }
  return null;
};

type SubmitMessageParams = {
  id: string;
  messageId: string;
  parts: UIMessage["parts"];
  onInitialMessage?: (message: UIMessage) => Promise<void> | void;
  sendMessage: (message: UIMessage) => Promise<void>;
  setMessages: (messages: UIMessage[]) => void;
  triggerError: (message: string) => void;
  setInput: (value: string) => void;
  setIsSendingMessage: (value: boolean) => void;
};

/**
 * Submits a user message, handling welcome-thread creation vs. normal streaming send,
 * and guaranteeing UI cleanup.
 */
export const submitMessageEffect = (
  params: SubmitMessageParams,
): Effect.Effect<boolean, ChatError, never> =>
  Effect.gen(function* (_) {
    let succeeded = false;

    if (params.id === "welcome" && params.onInitialMessage) {
      const onInitialMessage = params.onInitialMessage;
      const optimisticMessage: UIMessage = {
        id: params.messageId,
        role: "user",
        parts: params.parts,
      };

      // Show optimistic message immediately
      params.setMessages([optimisticMessage]);

      // Create thread and navigate
      yield* _(
        Effect.tryPromise({
          try: () => Promise.resolve(onInitialMessage(optimisticMessage)),
          catch: (error) => {
            const abort = asAbortError(error);
            if (abort) return abort;
            return new MessageSubmitError({
              message: "Failed to create thread",
              messageId: params.messageId,
              cause: error,
            });
          },
        }),
      );
      succeeded = true;
    } else if (params.id !== "welcome") {
      // Chat send handled by AI SDK
      yield* _(
        Effect.tryPromise({
          try: () =>
            params.sendMessage({
              id: params.messageId,
              role: "user",
              parts: params.parts,
            }),
          catch: (error) => {
            const abort = asAbortError(error);
            if (abort) return abort;
            return new MessageSubmitError({
              message: "Failed to send message",
              messageId: params.messageId,
              cause: error,
            });
          },
        }),
      );
      succeeded = true;
    }

    return succeeded;
  }).pipe(
    Effect.mapError((error): ChatError =>
      isChatError(error)
        ? error
        : new MessageSubmitError({
            message: "Unexpected message submit error",
            messageId: params.messageId,
            cause: error,
          }),
    ),
    Effect.catchAllCause((cause) => {
      const failure = Cause.failureOption(cause);
      if (Option.isSome(failure)) {
        return Effect.fail(failure.value);
      }
      return Effect.fail(
        new MessageSubmitError({
          message: "Unexpected message submit error",
          messageId: params.messageId,
          cause,
        }),
      );
    }),
    Effect.tapError((error) =>
      Effect.sync(() => {
        console.error("Failed to send message:", error);
      }),
    ),
    Effect.ensuring(
      Effect.sync(() => {
        params.setIsSendingMessage(false);
      }),
    ),
  );

