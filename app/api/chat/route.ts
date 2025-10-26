import {
  streamText,
  convertToModelMessages,
  UIMessage,
  smoothStream,
  stepCountIs,
} from "ai";
import { withTracing } from "@posthog/ai";
import { PostHog } from "posthog-node";
import { withSupermemory, supermemoryTools } from "@supermemory/tools/ai-sdk";
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
      if (!operation) continue;

      // Retry with exponential backoff for transient network errors
      const maxAttempts = 4;
      let attempt = 0;
      while (attempt < maxAttempts) {
        try {
          await operation();
          break; // success
        } catch (error: any) {
          attempt++;
          const isTimeout =
            error?.code === "ETIMEDOUT" ||
            error?.name === "TimeoutError" ||
            /fetch failed/i.test(String(error)) ||
            /network/i.test(String(error));

          if (!isTimeout || attempt >= maxAttempts) {
            console.error("Database operation failed:", error);
            break;
          }

          const delayMs = Math.min(1000 * 2 ** (attempt - 1), 5000);
          await new Promise((r) => setTimeout(r, delayMs));
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
    // Create traced model for PostHog LLM analytics
    const baseModel = getLanguageModel(modelId);
    const supermemoryEnabled = Boolean(process.env.SUPERMEMORY_API_KEY);
    const modelWithMemory = supermemoryEnabled
      ? withSupermemory(baseModel, auth.userId, {
          mode: "profile",
          verbose: process.env.NODE_ENV !== "production",
        })
      : baseModel;
    const phClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || "", {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    });
    const model = withTracing(modelWithMemory, phClient, {
      posthogDistinctId: auth.userId,
      posthogTraceId: newMessageId,
      posthogProperties: {
        threadId,
        modelId,
        quotaType,
        orgId: auth.orgId || null,
        trigger: trigger || "submit-message",
      },
      posthogPrivacyMode: false,
      posthogGroups: auth.orgId ? { organization: auth.orgId } : undefined,
    });

    // Tools setup
    const providerTools = enabledTools.length > 0
      ? createToolsForModel(modelId, enabledTools)
      : {};
    
    // Add EXA web search tool if web search is requested
    const tools = {
      ...providerTools,
      ...(enabledTools.includes("web_search") ? { webSearch: exaWebSearch } : {}),
      ...(process.env.SUPERMEMORY_API_KEY
        ? supermemoryTools(process.env.SUPERMEMORY_API_KEY, {
            containerTags: auth.orgId ? [auth.userId, auth.orgId] : [auth.userId],
          })
        : {}),
    };
    const providerOptions = getProviderOptions(modelId);

    console.log(`Time after model/tools setup: ${Date.now() - start}ms`);

    // Capture identifiers needed for server-only Convex calls
    const userId = auth.userId;
    const orgId = auth.orgId;

    // Synchronous finalization with retries
    const finalizeWithRetry = async (args: {
      ok: boolean;
      finalContent?: string;
      finalReasoning?: string;
      error?: { type: string; message: string };
      context: string;
    }) => {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await fetchMutation(
            api.threads.serverFinalizeAssistantMessage,
            {
              secret: process.env.CONVEX_SECRET_TOKEN!,
              userId,
              messageId: newMessageId,
              ok: args.ok,
              finalContent: args.finalContent,
              finalReasoning: args.finalReasoning,
              error: args.error,
            },
          );
          // success
          return;
        } catch (e: any) {
          const errMsg = typeof e?.message === "string" ? e.message : String(e);
          if (attempt === maxAttempts) break;
          const backoff = Math.min(250 * 2 ** (attempt - 1), 2000);
          const jitter = Math.floor(Math.random() * 100);
          await new Promise((r) => setTimeout(r, backoff + jitter));
        }
      }
    };

    // Handle regeneration: synchronously delete messages after the target message
    if (trigger === "regenerate-message" && messageId) {
      // First verify the user owns this thread
      const threadInfo = await fetchQuery(
        api.threads.serverGetThreadInfo,
        { secret: process.env.CONVEX_SECRET_TOKEN!, userId, threadId },
      );

      if (!threadInfo) {
        throw new Error("Thread not found or access denied");
      }

      // Await deletion to ensure persistence before streaming begins
      await fetchMutation(
        api.threads.serverDeleteMessagesAfter,
        {
          secret: process.env.CONVEX_SECRET_TOKEN!,
          userId,
          threadId,
          afterMessageId: messageId,
        },
      );
    }

    // Check quota limits BEFORE making AI request - for both new messages and regenerations
    const lastUser = messages.filter((m) => m.role === "user").pop();
    const userText = lastUser?.parts?.find(part => part.type === "text")?.text;
    const userFiles = lastUser?.parts?.filter(part => part.type === "file") || [];
    
    if (lastUser && (userText || userFiles.length > 0)) {
      // Check quota limits first (blocking)
      const quotaCheck = await fetchQuery(
        api.users.serverCheckUserQuota,
        { secret: process.env.CONVEX_SECRET_TOKEN!, userId, orgId: orgId!, quotaType },
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
          api.users.serverGetUserBothQuotas,
          { secret: process.env.CONVEX_SECRET_TOKEN!, userId, orgId: orgId! },
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
            api.threads.serverSendMessage,
            {
              secret: process.env.CONVEX_SECRET_TOKEN!,
              userId,
              orgId: orgId!,
              threadId,
              content: userText || "",
              model: modelId,
              messageId: lastUser.id,
              quotaType,
              attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
            },
          );
        });
      } else {
        // For regenerations: only increment quota (no message persistence)
        DatabaseQueue.add(async () => {
          await fetchMutation(
            api.users.serverIncrementUserQuota,
            { secret: process.env.CONVEX_SECRET_TOKEN!, userId, orgId: orgId!, quotaType },
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

        let content = "";
        let reasoning = "";
        let isComplete = false;
        let toolCallCount = 0;

        // Background: Start assistant message
        DatabaseQueue.add(async () => {
          await fetchMutation(
            api.threads.serverStartAssistantMessage,
            {
              secret: process.env.CONVEX_SECRET_TOKEN!,
              userId,
              threadId,
              messageId: newMessageId,
              model: modelId,
            },
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
                api.threads.serverAppendAssistantMessageDelta,
                {
                  secret: process.env.CONVEX_SECRET_TOKEN!,
                  userId,
                  messageId: newMessageId,
                  delta: update.content || " ",
                  reasoningDelta:
                    update.reasoning.length > 0 ? update.reasoning : undefined,
                },
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
          const systemPrompt = process.env.SUPERMEMORY_API_KEY
            ? `You are a helpful personal assistant. When users share information about themselves,
              remember it using the addMemory tool. When they ask questions that seem relevant to their memories, search your memories to provide
              personalized responses. do not over use user memories, only use them if the question seems relevant to their memories.
                1. Remembering their learning progress and struggles
                2. Searching for relevant information from their past sessions
                3. Providing personalized explanations based on their learning style
                4. Tracking topics they've mastered vs topics they need more help with`
                
            : undefined;
          const result = streamText({
            model,
            messages: convertToModelMessages(filterMessagesForModel(messages as UIMessage[], modelId)), // Filter unsupported file types for non-supporting models
            tools,
            system: systemPrompt,
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
                          api.threads.serverAddSourcesToMessage,
                          {
                            secret: process.env.CONVEX_SECRET_TOKEN!,
                            userId,
                            messageId: newMessageId,
                            sources: sources,
                          },
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
              if (isComplete) return;
              isComplete = true;
              cleanup();

              // Final flush and finalization
              await flushUpdate();

              const success = content.length > 0;
              await finalizeWithRetry({
                ok: success,
                finalContent: success ? content : undefined,
                finalReasoning: reasoning || undefined,
                error: success ? undefined : { type: "empty", message: "No content generated" },
                context: "onFinish",
              });

              // Ensure PostHog flush
              phClient.shutdown();

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
                await flushUpdate();
                await finalizeWithRetry({
                  ok: true,
                  finalContent: content.length > 0 ? content : undefined,
                  finalReasoning: reasoning || undefined,
                  context: "abort",
                });

                // Increment tool call quota when abort
                // Ensure PostHog flush on abort
                phClient.shutdown();

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
              // Ensure PostHog flush on error
              phClient.shutdown();
              await finalizeWithRetry({
                ok: false,
                error: {
                  type: "generation",
                  message: errorObj.message || "Stream failed",
                },
                context: "error",
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