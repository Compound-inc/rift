import { streamText, convertToModelMessages, UIMessage } from "ai";
import {
  getLanguageModel,
  getProviderOptions,
  isPremium,
} from "@/lib/ai/ai-providers";
import { createToolsForModel } from "@/lib/ai/model-tools";
import { ToolType } from "@/lib/ai/config/base";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { smoothStream } from "ai";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { withAuth } from "@workos-inc/authkit-nextjs";

export const runtime = "edge";
export const maxDuration = 300;

interface RequestBody {
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    parts?: Array<{ type: string; text?: string }>;
  }>;
  modelId: string;
  threadId: string;
  enabledTools?: ToolType[];
  trigger?: "submit-message" | "regenerate-message";
  messageId?: string;
}

interface AuthContext {
  token: string;
  userId: string;
  orgId?: string;
}

class StreamError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = "StreamError";
  }
}

// Input validation
function validateRequest(body: unknown): RequestBody {
  const data = body as Record<string, unknown>;
  if (
    !data?.messages ||
    !Array.isArray(data.messages) ||
    !data.messages.length ||
    !data?.modelId ||
    !data?.threadId
  ) {
    throw new StreamError("Missing required fields", 400);
  }

  if (data.messages.length > 50) {
    throw new StreamError("Too many messages", 400);
  }

  return data as unknown as RequestBody;
}

// Auth with error handling
async function getAuth(): Promise<AuthContext> {
  const auth = await withAuth();
  if (!auth.accessToken || !auth.user?.id) {
    throw new StreamError("Unauthorized", 401);
  }

  return {
    token: auth.accessToken,
    userId: auth.user.id,
    orgId: auth.organizationId,
  };
}

// Background database operations (non-blocking)
class DatabaseQueue {
  private static queue: Array<() => Promise<void>> = [];
  private static processing = false;

  static async add(operation: () => Promise<void>) {
    this.queue.push(operation);
    if (!this.processing) {
      this.processing = true;
      // Process queue in background
      setTimeout(() => this.process(), 0);
    }
  }

  private static async process() {
    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error("Database operation failed:", error);
        }
      }
    }
    this.processing = false;
  }
}

export async function POST(req: Request) {
  const start = Date.now();

  try {
    // Early abort check
    if (req.signal?.aborted) {
      return new Response("Aborted", { status: 499 });
    }

    // Parse and validate request
    const body = await req.json();
    const {
      messages,
      modelId,
      threadId,
      enabledTools = [],
      trigger,
      messageId,
    } = validateRequest(body);

    console.log(`Time after validation: ${Date.now() - start}ms`);

    // Authentication
    const auth = await getAuth();

    console.log(`Time after authentication: ${Date.now() - start}ms`);

    const quotaType = isPremium(modelId) ? "premium" : "standard";
    const newMessageId = crypto.randomUUID();
    const model = getLanguageModel(modelId);

    // Tools setup
    const tools =
      enabledTools.length > 0
        ? createToolsForModel(modelId, enabledTools)
        : undefined;
    const providerOptions = getProviderOptions(modelId);

    console.log(`Time after model/tools setup: ${Date.now() - start}ms`);

    // Handle regeneration: delete messages after the target message
    if (trigger === "regenerate-message" && messageId) {
      DatabaseQueue.add(async () => {
        await fetchMutation(
          api.threads.deleteMessagesAfter,
          {
            threadId,
            afterMessageId: messageId,
          },
          { token: auth.token },
        );
        console.log("deleteMessagesAfter completed");
      });
    }

    // Background: Persist user message (non-blocking) - only for new messages
    if (trigger !== "regenerate-message") {
      const lastUser = messages.filter((m) => m.role === "user").pop();
      const userText = lastUser?.parts?.[0]?.text;
      if (lastUser && userText) {
        DatabaseQueue.add(async () => {
          await fetchMutation(
            api.threads.sendMessage,
            {
              threadId,
              content: userText,
              model: modelId,
              messageId: lastUser.id,
              quotaType,
            },
            { token: auth.token },
          );
        });
      }
    }

    // Start streaming response
    const stream = createUIMessageStream({
      originalMessages: messages as UIMessage[], // Type assertion for AI SDK compatibility
      execute: async ({ writer }) => {
        writer.write({ type: "start", messageId });

        console.log(`Stream execution started: ${Date.now() - start}ms`);

        let content = "";
        let reasoning = "";
        let isComplete = false;

        // Background: Start assistant message
        DatabaseQueue.add(async () => {
          await fetchMutation(
            api.threads.startAssistantMessage,
            {
              threadId,
              messageId: newMessageId,
              model: modelId,
            },
            { token: auth.token },
          );
        });

        // Batch update mechanism for database writes
        let pendingUpdate = { content: "", reasoning: "" };
        const flushUpdate = async () => {
          if (
            (!pendingUpdate.content && !pendingUpdate.reasoning) ||
            isComplete
          )
            return;

          const update = { ...pendingUpdate };
          pendingUpdate = { content: "", reasoning: "" };

          if (update.content.length > 0 || update.reasoning.length > 0) {
            DatabaseQueue.add(async () => {
              await fetchMutation(
                api.threads.appendAssistantMessageDelta,
                {
                  messageId: newMessageId,
                  delta: update.content || " ",
                  reasoningDelta:
                    update.reasoning.length > 0 ? update.reasoning : undefined,
                },
                { token: auth.token },
              );
            });
          }
        };

        // Periodic flush (every 2 seconds)
        const flushInterval = setInterval(() => flushUpdate(), 2000);

        const cleanup = () => {
          clearInterval(flushInterval);
        };

        req.signal?.addEventListener("abort", cleanup);

        console.log(`Starting streamText call: ${Date.now() - start}ms`);

        try {
          const result = streamText({
            model,
            messages: convertToModelMessages(messages as UIMessage[]), // Type assertion for AI SDK
            tools,
            experimental_transform: smoothStream({
              delayInMs: 15,
              chunking: "word",
            }),
            abortSignal: req.signal,
            providerOptions,
            onChunk: ({ chunk }) => {
              if (req.signal?.aborted) return;

              if (chunk.type === "text-delta" && chunk.text) {
                content += chunk.text;
                pendingUpdate.content += chunk.text;
              } else if (chunk.type === "reasoning-delta" && chunk.text) {
                reasoning += chunk.text;
                pendingUpdate.reasoning += chunk.text;
              }
            },
            onFinish: async () => {
              console.log(
                `StreamText finished (total generation time): ${Date.now() - start}ms`,
              );
              if (req.signal?.aborted || isComplete) return;
              isComplete = true;
              cleanup();

              // Final flush and finalization
              await flushUpdate();

              DatabaseQueue.add(async () => {
                const success = content.length >= 5; // Minimum viable response
                await fetchMutation(
                  api.threads.finalizeAssistantMessage,
                  {
                    messageId: newMessageId,
                    ok: success,
                    finalContent: content || undefined,
                    finalReasoning: reasoning || undefined,
                    error: success
                      ? undefined
                      : { type: "empty", message: "No content generated" },
                  },
                  { token: auth.token },
                );
              });
            },
            onError: async (error) => {
              if (isComplete) return;
              isComplete = true;
              cleanup();

              const errorObj = error.error as Error;
              const isAbort =
                errorObj.name === "AbortError" || req.signal?.aborted;
              if (isAbort) {
                // Handle graceful abort
                const hasContent = content.length >= 5;
                if (hasContent) {
                  await flushUpdate();
                  DatabaseQueue.add(async () => {
                    await fetchMutation(
                      api.threads.finalizeAssistantMessage,
                      {
                        messageId: newMessageId,
                        ok: true,
                        finalContent: content,
                        finalReasoning: reasoning || undefined,
                      },
                      { token: auth.token },
                    );
                  });
                }
                return;
              }

              // Handle actual errors
              console.error("Stream error:", error);
              DatabaseQueue.add(async () => {
                await fetchMutation(
                  api.threads.finalizeAssistantMessage,
                  {
                    messageId: newMessageId,
                    ok: false,
                    error: {
                      type: "generation",
                      message: errorObj.message || "Stream failed",
                    },
                  },
                  { token: auth.token },
                );
              });

              writer.write({
                type: "error",
                errorText: "Generation failed. Please try again.",
              });
            },
          });

          writer.merge(result.toUIMessageStream({ sendStart: false }));
        } catch (error) {
          cleanup();
          throw error;
        }
      },
    });

    const response = createUIMessageStreamResponse({
      stream,
      headers: {
        "X-Response-Time": `${Date.now() - start}ms`,
      },
    });

    return response;
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof StreamError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: {
          "Content-Type": "application/json",
          "X-Response-Time": `${Date.now() - start}ms`,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "X-Response-Time": `${Date.now() - start}ms`,
      },
    });
  }
}
