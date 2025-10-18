import {
  streamText,
  convertToModelMessages,
  UIMessage,
  smoothStream,
  stepCountIs,
} from "ai";
import {
  getLanguageModel,
  getProviderOptions,
  isPremium,
  isCapable,
} from "@/lib/ai/ai-providers";
import { createToolsForModel } from "@/lib/ai/model-tools";
import { ToolType } from "@/lib/ai/config/base";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { exaWebSearch } from "@/lib/ai/tools/exa-search";

export const maxDuration = 300;

interface RequestBody {
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    parts?: Array<{ 
      type: string; 
      text?: string;
      mediaType?: string;
      url?: string;
      attachmentId?: string;
    }>;
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

// Helper function to filter attachments for models that don't support them
function filterMessagesForModel(messages: UIMessage[], modelId: string): UIMessage[] {
  const supportsImages = isCapable(modelId, "supportsImageInput");
  const supportsPDFs = isCapable(modelId, "supportsPDFInput");
  
  // If model supports both images and PDFs, return messages as-is
  if (supportsImages && supportsPDFs) {
    return messages;
  }
  
  // Filter out unsupported file types from all messages
  return messages.map(msg => {
    if (!msg.parts || msg.parts.length === 0) {
      return msg;
    }
    
    return {
      ...msg,
      parts: msg.parts.filter(part => {
        if (part.type !== "file") {
          return true; // Keep non-file parts
        }
        
        // Check if this is an image file
        const isImage = part.mediaType?.startsWith("image/");
        if (isImage && !supportsImages) {
          return false; // Remove image files if model doesn't support images
        }
        
        // Check if this is a PDF file
        const isPDF = part.mediaType === "application/pdf";
        if (isPDF && !supportsPDFs) {
          return false; // Remove PDF files if model doesn't support PDFs
        }
        
        // Keep other file types or supported file types
        return true;
      }),
    };
  });
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
  // TODO: Add smart Summary of the conversation instead of this:
  // If there are more than 50 messages, keep only the latest 50 for context
  if (data.messages.length > 50) {
    data.messages = data.messages.slice(-50);
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
    // Validate regenerate requests
    if (trigger === "regenerate-message" && !messageId) {
      return new Response(JSON.stringify({ error: "Missing messageId for regenerate" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Response-Time": `${Date.now() - start}ms`,
        },
      });
    }


    console.log(`Time after validation: ${Date.now() - start}ms`);

    // Authentication
    const auth = await getAuth();

    console.log(`Time after authentication: ${Date.now() - start}ms`);

    const quotaType = isPremium(modelId) ? "premium" : "standard";
    const newMessageId = crypto.randomUUID();
    const model = getLanguageModel(modelId);

    // Tools setup
    const providerTools = enabledTools.length > 0
      ? createToolsForModel(modelId, enabledTools)
      : {};
    
    // Add EXA web search tool if web search is requested
    const tools = {
      ...providerTools,
      ...(enabledTools.includes("web_search") ? { webSearch: exaWebSearch } : {}),
    };
    const providerOptions = getProviderOptions(modelId);

    console.log(`Time after model/tools setup: ${Date.now() - start}ms`);

    // Handle regeneration: synchronously delete messages after the target message
    if (trigger === "regenerate-message" && messageId) {
      // First verify the user owns this thread
      const threadInfo = await fetchQuery(
        api.threads.getThreadInfo,
        { threadId },
        { token: auth.token },
      );

      if (!threadInfo) {
        throw new Error("Thread not found or access denied");
      }

      // Await deletion to ensure persistence before streaming begins
      await fetchMutation(
        api.threads.deleteMessagesAfter,
        {
          threadId,
          afterMessageId: messageId,
        },
        { token: auth.token },
      );
    }

    // Check quota limits BEFORE making AI request - for both new messages and regenerations
    const lastUser = messages.filter((m) => m.role === "user").pop();
    const userText = lastUser?.parts?.find(part => part.type === "text")?.text;
    const userFiles = lastUser?.parts?.filter(part => part.type === "file") || [];
    
    if (lastUser && (userText || userFiles.length > 0)) {
      // Check quota limits first (blocking)
      const quotaCheck = await fetchQuery(
        api.users.checkUserQuota,
        { quotaType },
        { token: auth.token },
      );

      if (!quotaCheck.allowed) {
        // Check if quota is not configured (no subscription)
        if (!quotaCheck.quotaConfigured) {
          const errorResponse = {
            error: "No subscription",
            message: "Organization has no active subscription configured",
            quotaType,
          };

          return new Response(JSON.stringify(errorResponse), {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "X-Response-Time": `${Date.now() - start}ms`,
            },
          });
        }

        // Get both quota types for detailed error message (quota exceeded case)
        const bothQuotas = await fetchQuery(
          api.users.getUserBothQuotas,
          {},
          { token: auth.token },
        );

        const errorResponse = {
          error: "Quota exceeded",
          message: `Message quota exceeded. Usage: ${quotaCheck.currentUsage}/${quotaCheck.limit} messages`,
          quotaType,
          quotaInfo: {
            currentUsage: quotaCheck.currentUsage,
            limit: quotaCheck.limit,
          },
          otherQuotaInfo: {
            currentUsage: quotaType === "standard" 
              ? bothQuotas.premium.currentUsage 
              : bothQuotas.standard.currentUsage,
            limit: quotaType === "standard" 
              ? bothQuotas.premium.limit 
              : bothQuotas.standard.limit,
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-Response-Time": `${Date.now() - start}ms`,
          },
        });
      }

      // Handle quota increment based on trigger type
      if (trigger !== "regenerate-message") {
        // Extract attachment IDs from file parts
        const attachmentIds = userFiles
          .filter(part => part.attachmentId)
          .map(part => part.attachmentId! as Id<"attachments">);
        
        // For new messages: persist user message (which also increments quota)
        DatabaseQueue.add(async () => {
          await fetchMutation(
            api.threads.sendMessage,
            {
              threadId,
              content: userText || "", // Handle case where there's no text but there are files
              model: modelId,
              messageId: lastUser.id,
              quotaType,
              secretToken: process.env.CONVEX_SECRET_TOKEN!,
              attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
            },
            { token: auth.token },
          );
        });
      } else {
        // For regenerations: only increment quota (no message persistence)
        DatabaseQueue.add(async () => {
          await fetchMutation(
            api.users.incrementUserQuota,
            { quotaType },
            { token: auth.token },
          );
        });
      }
    }

    // Start streaming response
    const stream = createUIMessageStream({
      originalMessages: messages as UIMessage[], // Type assertion for AI SDK compatibility
      execute: async ({ writer }) => {
        // Start assistant UI message with the server-side generated id so UI and DB ids match
        writer.write({ type: "start", messageId: newMessageId });

        console.log(`Stream execution started: ${Date.now() - start}ms`);

        let content = "";
        let reasoning = "";
        let isComplete = false;
        let toolCallCount = 0;

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
            messages: convertToModelMessages(filterMessagesForModel(messages as UIMessage[], modelId)), // Filter unsupported file types for non-supporting models
            tools,
            stopWhen: stepCountIs(3), // Allow multi-step tool usage for web search
            experimental_transform: smoothStream({
              delayInMs: 5,
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
              } else if (chunk.type === "tool-call") {
                toolCallCount++;
              } else if (chunk.type === "tool-result" && chunk.toolName === "webSearch") {
                // Extract sources from web search tool results
                const toolResult = chunk.output as any[];
                if (Array.isArray(toolResult)) {
                  const sources = toolResult
                    .filter((result: any) => result.url)
                    .map((result: any, index: number) => ({
                      sourceId: `source-${Date.now()}-${index}`,
                      url: result.url,
                      title: result.title || result.url,
                    }));

                  // Stream sources to client
                  sources.forEach((source) => {
                    writer.write({
                      type: "source-url",
                      sourceId: source.sourceId,
                      url: source.url,
                      title: source.title,
                    });
                  });

                  // Save sources to database
                  if (sources.length > 0) {
                    DatabaseQueue.add(async () => {
                      try {
                        await fetchMutation(
                          api.threads.addSourcesToMessage,
                          {
                            messageId: newMessageId,
                            sources: sources,
                          },
                          { token: auth.token },
                        );
                      } catch (error) {
                        console.error("Failed to save sources to database:", error);
                      }
                    });
                  }
                }
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
                const success = content.length > 0; // Minimum viable response
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

              // Increment tool call quota if any tools were used when the assistant message is finalized
              if (toolCallCount > 0) {
                DatabaseQueue.add(async () => {
                  try {
                    await fetch(`${process.env.CONVEX_SITE_URL}/increment-tool-call-quota`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.CONVEX_SECRET_TOKEN}`,
                      },
                      body: JSON.stringify({
                        userId: auth.userId,
                        toolCallCount,
                      }),
                    });
                    console.log(`Incremented tool call quota by ${toolCallCount} for user`);
                  } catch (error) {
                    console.error("Failed to increment tool call quota:", error);
                    // Don't fail the request if quota increment fails
                  }
                });
              }
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
                const hasContent = content.length > 0;
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

                // Increment tool call quota when abort
                if (toolCallCount > 0) {
                  DatabaseQueue.add(async () => {
                    try {
                      await fetch(`${process.env.CONVEX_SITE_URL}/increment-tool-call-quota`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${process.env.CONVEX_SECRET_TOKEN}`,
                        },
                        body: JSON.stringify({
                          userId: auth.userId,
                          toolCallCount,
                        }),
                      });
                      console.log(`Incremented tool call quota by ${toolCallCount} for user (abort)`);
                    } catch (error) {
                      console.error("Failed to increment tool call quota (abort):", error);
                      // Don't fail the request if quota increment fails
                    }
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

          // We already sent a start with newMessageId above; stream sources and reasoning parts
          writer.merge(
            result.toUIMessageStream({ sendStart: false, sendSources: true, sendReasoning: true })
          );
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