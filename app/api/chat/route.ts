import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
} from "ai";
import {
  getLanguageModel,
  getProviderOptions,
  isPremium,
} from "@/lib/ai/ai-providers";
import { createToolsForModel } from "@/lib/ai/model-tools";
import { ToolType } from "@/lib/ai/config/base";
import { api } from "@/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { Id } from "@/convex/_generated/dataModel";
import { PostHog } from "posthog-node";
import { withTracing } from "@posthog/ai";

// Allow streaming responses up to 280 seconds
export const maxDuration = 280;

// Enhanced error boundary wrapper
async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  statusCode: number = 500,
): Promise<T | Response> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return new Response(
      JSON.stringify({
        error: errorMessage,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Optimized auth context
interface AuthContext {
  accessToken: string;
  user: { id: string; organizationId?: string };
}

async function getAuthContext(): Promise<AuthContext | Response> {
  return withErrorBoundary(
    async () => {
      const authResult = await withAuth();
      if (!authResult.accessToken || !authResult.user) {
        throw new Error("Unauthorized");
      }
      return {
        accessToken: authResult.accessToken,
        user: {
          id: authResult.user.id,
          organizationId: authResult.organizationId,
        },
      };
    },
    "Authentication failed",
    401,
  );
}

export async function POST(req: Request) {
  // Get abort signal and early abort check
  const abortSignal = req.signal;
  if (abortSignal?.aborted) {
    return new Response("Request aborted", { status: 499 });
  }

  // Parse request with error boundary
  const requestData = await withErrorBoundary(
    async () => {
      return (await req.json()) as {
        messages: UIMessage[];
        modelId: string;
        threadId: string;
        enabledTools?: ToolType[];
      };
    },
    "Invalid request data",
    400,
  );

  if (requestData instanceof Response) return requestData;

  const { messages, modelId, threadId, enabledTools = [] } = requestData;

  // Determine quota type
  const quotaType: "standard" | "premium" = isPremium(modelId)
    ? "premium"
    : "standard";

  console.log(`Using ${quotaType} quota for model: ${modelId}`);

  // Optimized auth and quota check
  const authContext = await getAuthContext();
  if (authContext instanceof Response) return authContext;

  const quotaCheck = await withErrorBoundary(async () => {
    const bothQuotas = await fetchQuery(
      api.users.getUserBothQuotas,
      {},
      { token: authContext.accessToken },
    );

    const currentQuota = bothQuotas[quotaType];
    const otherQuota =
      bothQuotas[quotaType === "premium" ? "standard" : "premium"];

    if (!currentQuota.allowed) {
      throw new Response(
        JSON.stringify({
          error: "Quota exceeded",
          message: `Message quota exceeded. Usage: ${currentQuota.currentUsage}/${currentQuota.limit} messages`,
          quotaInfo: currentQuota,
          otherQuotaInfo: otherQuota,
          quotaType: quotaType,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return { currentQuota, otherQuota };
  }, "Quota check failed");

  if (quotaCheck instanceof Response) return quotaCheck;

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const assistantMessageId = crypto.randomUUID();
      let assistantMessageStarted = false;
      let finalizationPromise: Promise<void> | null = null;
      let totalContent = "";
      let totalReasoning = "";
      let isAborted = false;

      // Use pre-authenticated context
      const { accessToken, user } = authContext;

      // Immediately signal start to the client
      writer.write({ type: "start", messageId: assistantMessageId });

      let languageModel = getLanguageModel(modelId);

      // PostHog tracking
      const setupPostHogTracking = async () => {
        if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return languageModel;

        const result = await withErrorBoundary(async () => {
          const phClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
            host: "https://us.i.posthog.com",
            flushAt: 1,
            flushInterval: 0,
          });

          const tracedModel = withTracing(languageModel, phClient, {
            posthogDistinctId: user.id,
            posthogTraceId: threadId,
            posthogProperties: {
              conversationId: threadId,
              model: modelId,
              requestId: assistantMessageId,
              enabledTools:
                enabledTools.length > 0 ? enabledTools.join(",") : undefined,
            },
            posthogPrivacyMode: false,
            ...(user.organizationId && {
              posthogGroups: { organization: user.organizationId },
            }),
          });

          // Cleanup handler
          const cleanup = () => {
            try {
              phClient.shutdown();
            } catch (e) {
              console.warn("PostHog shutdown error:", e);
            }
          };

          process.on("beforeExit", cleanup);
          abortSignal?.addEventListener("abort", cleanup);

          return tracedModel;
        }, "PostHog setup failed");

        return result instanceof Response ? languageModel : result;
      };

      languageModel = await setupPostHogTracking();
      console.debug("AI streaming with model", modelId);

      // Batch persistence every ~1500ms without affecting client stream
      let pendingDelta = "";
      let pendingReasoning = "";
      let lastFlushAt = Date.now();
      const FLUSH_EVERY_MS = 1500;
      let gotAnyDelta = false;
      let gotAnyReasoning = false;
      let startAssistantPromise: Promise<
        { messageDocId: Id<"messages"> } | undefined
      > | null = null;

      const flush = async () => {
        if (
          abortSignal?.aborted ||
          isAborted ||
          (pendingDelta.length === 0 && pendingReasoning.length === 0)
        )
          return;

        if (startAssistantPromise) {
          try {
            const result = await startAssistantPromise;
            if (!result) return;
          } catch {
            return;
          }
        }

        if (abortSignal?.aborted || isAborted) return;

        const toSendContent = pendingDelta;
        const toSendReasoning = pendingReasoning;
        pendingDelta = "";
        pendingReasoning = "";
        lastFlushAt = Date.now();

        // Error handling for database operations
        await withErrorBoundary(async () => {
          await fetchMutation(
            api.threads.appendAssistantMessageDelta,
            {
              messageId: assistantMessageId,
              delta: toSendContent,
              reasoningDelta:
                toSendReasoning.length > 0 ? toSendReasoning : undefined,
            },
            { token: accessToken },
          );
        }, "Failed to flush message delta");
      };

      // Abort handling with error boundaries
      const handleAbort = async () => {
        if (isAborted) return;
        isAborted = true;

        if (!assistantMessageStarted && !startAssistantPromise) return;

        if (!finalizationPromise) {
          const result = withErrorBoundary(async () => {
            if (startAssistantPromise) {
              try {
                const result = await startAssistantPromise;
                if (!result) return;
              } catch (e) {
                console.error("Failed to create assistant message:", e);
                return;
              }
            }

            const contentToSave = totalContent + pendingDelta;
            const reasoningToSave = totalReasoning + pendingReasoning;

            await fetchMutation(
              api.threads.finalizeAssistantMessage,
              {
                messageId: assistantMessageId,
                ok: true,
                finalContent: contentToSave,
                finalReasoning:
                  reasoningToSave.length > 0 ? reasoningToSave : undefined,
                error: undefined,
              },
              { token: accessToken },
            );
          }, "Failed to finalize on abort");

          finalizationPromise =
            result instanceof Response
              ? Promise.resolve()
              : (result as Promise<void>);
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
      const providerOptions = getProviderOptions(modelId);

      // Start streaming from the model
      const result = streamText({
        model: languageModel,
        messages: convertToModelMessages(messages),
        tools,
        experimental_transform: smoothStream({
          delayInMs: 10,
          chunking: "word",
        }),
        abortSignal,
        providerOptions,
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
          } else if (
            chunk.type === "reasoning-delta" &&
            "text" in chunk &&
            typeof (chunk as { text: string }).text === "string" &&
            (chunk as { text: string }).text.length > 0
          ) {
            gotAnyReasoning = true;
            const reasoningText = (chunk as { text: string }).text;
            pendingReasoning += reasoningText;
            totalReasoning += reasoningText; // Accumulate total reasoning
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

          const result = withErrorBoundary(async () => {
            const ok =
              gotAnyDelta || gotAnyReasoning || (text?.length ?? 0) > 0;

            if (startAssistantPromise) {
              try {
                const result = await startAssistantPromise;
                if (!result) return;
              } catch (e) {
                console.error("Assistant message creation failed:", e);
                return;
              }
            }

            if (!abortSignal?.aborted && !isAborted) {
              const finalReasoningContent = totalReasoning + pendingReasoning;

              await fetchMutation(
                api.threads.finalizeAssistantMessage,
                {
                  messageId: assistantMessageId,
                  ok,
                  finalReasoning:
                    finalReasoningContent.length > 0
                      ? finalReasoningContent
                      : undefined,
                  error: ok
                    ? undefined
                    : {
                        type: "empty",
                        message: "No tokens received from provider",
                      },
                },
                { token: accessToken },
              );
            }
          }, "Failed to finalize message");

          finalizationPromise =
            result instanceof Response
              ? Promise.resolve()
              : (result as Promise<void>);

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

          const result = withErrorBoundary(async () => {
            if (startAssistantPromise) {
              try {
                const result = await startAssistantPromise;
                if (!result) return;
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
            );
          }, "Failed to finalize error");

          finalizationPromise =
            result instanceof Response
              ? Promise.resolve()
              : (result as Promise<void>);

          await finalizationPromise;
        },
      });
      writer.merge(result.toUIMessageStream({ sendStart: false }));

      // Enhanced message persistence with error boundaries
      const persistenceResult = await withErrorBoundary(async () => {
        // First, persist the user message
        const lastUser = [...messages].reverse().find((m) => m.role === "user");

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
              quotaType,
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
      }, "Failed to persist messages");

      startAssistantPromise = Promise.resolve(
        persistenceResult instanceof Response ? undefined : persistenceResult,
      );
    },
  });

  return createUIMessageStreamResponse({ stream });
}
