import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import {
  getLanguageModel,
  modelSupportsReasoning,
} from "@/lib/ai/ai-providers";
import { createToolsForModel, ToolType } from "@/lib/ai/model-tools";
import { api } from "@/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { Id } from "@/convex/_generated/dataModel";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Get abort signal from request for proper cancellation
  const abortSignal = req.signal;
  const {
    messages,
    modelId,
    threadId,
    enabledTools = [],
  }: {
    messages: UIMessage[];
    modelId: string;
    threadId: string;
    enabledTools?: ToolType[];
  } = await req.json();

  // Return early if request is already aborted
  if (abortSignal?.aborted) {
    return new Response("Request aborted", { status: 499 });
  }

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const assistantMessageId = crypto.randomUUID();
      let assistantMessageStarted = false;
      let finalizationPromise: Promise<void> | null = null;
      let totalContent = ""; // Track complete content for finalization
      let isAborted = false; // Track if request was manually aborted

      // Fetch auth lazily in parallel
      let accessToken: string | undefined;
      const authPromise = withAuth()
        .then(({ accessToken: token }) => {
          accessToken = token;
        })
        .catch((err) => {
          console.error("withAuth failed", err);
        });

      // Immediately signal start to the client so spinner shows instantly
      writer.write({ type: "start", messageId: assistantMessageId });

      const languageModel = getLanguageModel(modelId);
      console.debug("AI streaming with model", modelId);

      // Batch persistence every ~800ms without affecting client stream
      let pendingDelta = "";
      let lastFlushAt = Date.now();
      const FLUSH_EVERY_MS = 1500;
      let gotAnyDelta = false;
      let startAssistantPromise: Promise<
        { messageDocId: Id<"messages"> } | undefined
      > | null = null;

      const ensureAuth = async () => {
        if (!accessToken) {
          await authPromise;
        }
      };

      const flush = async () => {
        // Double-check abort status before any database operations
        if (abortSignal?.aborted || pendingDelta.length === 0) return;

        // Ensure assistant message doc exists before appending deltas
        if (startAssistantPromise) {
          try {
            const result = await startAssistantPromise;
            if (!result) {
              return; // Skip persisting if message creation failed
            }
          } catch {
            // If creation failed, skip persisting deltas
            return;
          }
        }

        // Final abort check before database write
        if (abortSignal?.aborted) return;

        await ensureAuth();
        const toSend = pendingDelta;
        pendingDelta = "";
        lastFlushAt = Date.now();

        // Only write to database if not aborted
        if (!abortSignal?.aborted) {
          fetchMutation(
            api.threads.appendAssistantMessageDelta,
            {
              messageId: assistantMessageId,
              delta: toSend,
            },
            { token: accessToken },
          ).catch(() => {});
        }
      };

      // Listen for abort from client
      const handleAbort = async () => {
        if (isAborted) return; // Prevent double execution
        isAborted = true;

        // If we abort before starting assistant message, don't try to finalize
        if (!assistantMessageStarted && !startAssistantPromise) {
          return;
        }

        if (!finalizationPromise) {
          finalizationPromise = (async (): Promise<void> => {
            try {
              await ensureAuth();

              // Wait for assistant message to be created first
              if (startAssistantPromise) {
                try {
                  const result = await startAssistantPromise;
                  if (!result) {
                    return;
                  }
                } catch (e) {
                  console.error("Failed to create assistant message:", e);
                  return;
                }
              }

              // Send any pending content + accumulated content directly in finalization
              const contentToSave = totalContent + pendingDelta;

              await fetchMutation(
                api.threads.finalizeAssistantMessage,
                {
                  messageId: assistantMessageId,
                  ok: true, // Mark as OK since user manually stopped
                  finalContent: contentToSave, // Send all content including pending
                  error: undefined,
                },
                { token: accessToken },
              );
            } catch (e) {
              console.error("Failed to finalize on abort:", e);
            }
          })();
        }

        return finalizationPromise;
      };

      // Set up abort listeners
      if (abortSignal) {
        abortSignal.addEventListener("abort", handleAbort);
      }

      if (req.signal) {
        req.signal.addEventListener("abort", handleAbort);
      }

      // Check if already aborted
      if (abortSignal?.aborted || req.signal?.aborted) {
        await handleAbort();
        return;
      }

      // Create tools for the model if any are enabled
      const tools =
        enabledTools.length > 0
          ? createToolsForModel(modelId, enabledTools)
          : undefined;

      // Check if this is a reasoning model to enable reasoning summaries
      const useReasoning = modelSupportsReasoning(modelId);

      // Start streaming from the model
      const result = streamText({
        // Accept union model from registry
        model: languageModel,
        messages: convertToModelMessages(messages),
        // @ts-expect-error AI SDK
        tools,
        abortSignal: abortSignal,
        // Add reasoning support for OpenAI reasoning models
        ...(useReasoning && {
          providerOptions: {
            openai: {
              reasoningSummary: "auto", // Enable reasoning summaries
            },
          },
        }),
        onChunk: async ({ chunk }) => {
          // Skip processing if aborted
          if (abortSignal?.aborted || isAborted) {
            return;
          }

          if (chunk.type === "text-delta" && chunk.text.length > 0) {
            gotAnyDelta = true;
            pendingDelta += chunk.text;
            totalContent += chunk.text; // Accumulate total content
            const now = Date.now();
            if (
              now - lastFlushAt >= FLUSH_EVERY_MS &&
              !abortSignal?.aborted &&
              !isAborted
            ) {
              await flush();
            }
          }
        },
        onFinish: async ({ text }) => {
          // Don't finalize if request was manually aborted
          if (abortSignal?.aborted || isAborted) {
            return;
          }

          // Final flush to ensure all content is saved
          await flush();

          // Prevent duplicate finalization with atomic promise
          if (finalizationPromise) {
            return finalizationPromise;
          }

          finalizationPromise = (async (): Promise<void> => {
            await ensureAuth();
            const ok = gotAnyDelta || (text?.length ?? 0) > 0;

            // Wait for assistant message to be created first
            if (startAssistantPromise) {
              try {
                const result = await startAssistantPromise;
                if (!result) {
                  return;
                }
              } catch (e) {
                console.error("Assistant message creation failed:", e);
                return;
              }
            }

            // Only finalize if not aborted
            if (!abortSignal?.aborted) {
              await fetchMutation(
                api.threads.finalizeAssistantMessage,
                {
                  messageId: assistantMessageId,
                  ok,
                  error: ok
                    ? undefined
                    : {
                        type: "empty",
                        message: "No tokens received from provider",
                      },
                },
                { token: accessToken },
              ).catch(() => {});
            }
          })();

          return finalizationPromise;
        },
        onError: async ({ error }) => {
          console.error("streamText error", error);

          // Check if this is an abort error
          const errorObj = error as Error;
          const isAbortError =
            errorObj?.name === "AbortError" ||
            errorObj?.message?.includes("aborted") ||
            errorObj?.message?.includes("cancelled") ||
            abortSignal?.aborted ||
            isAborted;

          if (isAbortError) {
            await handleAbort();
            return;
          }

          await flush();

          // Prevent duplicate finalization with atomic promise
          if (finalizationPromise) {
            return;
          }

          finalizationPromise = (async (): Promise<void> => {
            // Wait for assistant message to be created first
            if (startAssistantPromise) {
              try {
                const result = await startAssistantPromise;
                if (!result) {
                  return;
                }
              } catch (e) {
                console.error("Assistant message creation failed:", e);
                return;
              }
            }

            await fetchMutation(
              api.threads.finalizeAssistantMessage,
              {
                messageId: assistantMessageId,
                ok: false,
                error: { type: "generation", message: "stream error" },
              },
              { token: accessToken },
            ).catch((e) => {
              console.error("Failed to finalize error:", e);
            });
          })();

          await finalizationPromise;
        },
      });
      writer.merge(result.toUIMessageStream({ sendStart: false }));

      // Persist user message first, then start assistant message (proper order)
      startAssistantPromise = (async () => {
        try {
          await ensureAuth();

          // First, persist the user message
          const lastUser = [...messages]
            .reverse()
            .find((m) => m.role === "user");

          const lastUserText =
            lastUser?.parts
              ?.map((p) => {
                if (p.type === "text" && "text" in p) {
                  return p.text;
                }
                return "";
              })
              .join("") ?? "";
          const lastUserId = lastUser?.id;

          if (lastUser && lastUserId) {
            await fetchMutation(
              api.threads.sendMessage,
              {
                threadId,
                content: lastUserText,
                model: modelId,
                messageId: lastUserId,
              },
              { token: accessToken },
            );
          }

          // Then start assistant message (only once)
          if (!assistantMessageStarted) {
            assistantMessageStarted = true;
            return await fetchMutation(
              api.threads.startAssistantMessage,
              {
                threadId,
                messageId: assistantMessageId,
                model: modelId,
              },
              { token: accessToken },
            );
          }
        } catch (err) {
          console.error("startAssistantMessage failed", err);
          throw err;
        }
      })();
    },
  });

  return createUIMessageStreamResponse({ stream });
}
