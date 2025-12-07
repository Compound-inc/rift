import { Effect, Schedule, Scope, Queue, Ref, Fiber, Runtime, Chunk, Duration } from "effect";
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  smoothStream,
  stepCountIs,
  type LanguageModel,
  type ToolSet,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { withTracing } from "@posthog/ai";
import { PostHog } from "posthog-node";
import { withSupermemory, supermemoryTools } from "@supermemory/tools/ai-sdk";
import {
  getLanguageModel,
  getModel,
  getProviderDisplayName,
  getProviderOptions,
  isPremium,
} from "@/lib/ai/ai-providers";
import { createToolsForModel } from "@/lib/ai/model-tools";
import { ToolType } from "@/lib/ai/config/base";
import { Id } from "@/convex/_generated/dataModel";
import { exaWebSearch } from "@/lib/ai/tools/exa-search";
import {
  buildSystemPromptWithStyle,
  type ResponseStyle,
} from "@/lib/ai/response-styles";

import {
  ValidationError,
  AuthenticationError,
  NoOrganizationError,
  NoSubscriptionError,
  QuotaExceededError,
  StreamError,
  DatabaseError,
  AbortError,
  RegenerateError,
  ModelError,
  ToolError,
  TimeoutError,
  ProviderError,
  type ChatRouteError,
} from "./errors";

import {
  type RequestBody,
  type AuthContext,
  type LogContext,
  CONFIG,
  logger,
  validateRequestBody,
  validateRegenerateRequest,
  filterMessagesForModel,
  getAuthContext,
  checkUserQuota,
  handleRegeneration,
  sendUserMessage,
  incrementUserQuota,
  startAssistantMessage,
  appendMessageDelta,
  finalizeAssistantMessage,
  addSourcesToMessage,
  incrementToolCallQuota,
  databaseRetrySchedule,
  classifyProviderError,
  generateIdempotencyKey,
} from "./services";

export const maxDuration = 300;

// ============================================================================
// Request ID Generation
// ============================================================================

const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
};

// ============================================================================
// Response Helpers
// ============================================================================

const jsonResponse = (
  body: object,
  status: number,
  start: number
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Response-Time": `${Date.now() - start}ms`,
    },
  });

/**
 * Maps Effect errors to HTTP responses.
 */
const errorToResponse = (
  error: ChatRouteError,
  start: number,
  requestId: string
): Response => {
  const baseHeaders = {
    "Content-Type": "application/json",
    "X-Response-Time": `${Date.now() - start}ms`,
    "X-Request-ID": requestId,
  };

  const makeResponse = (body: object, status: number) =>
    new Response(JSON.stringify({ ...body, requestId }), {
      status,
      headers: baseHeaders,
    });

  switch (error._tag) {
    case "ValidationError":
      return makeResponse({ error: error.message, field: error.field }, 400);

    case "RegenerateError":
      return makeResponse({ error: error.message }, 400);

    case "AuthenticationError":
      return makeResponse({ error: error.message }, 401);

    case "NoOrganizationError":
      return makeResponse({ error: error.message }, 403);

    case "NoSubscriptionError":
      return makeResponse(
        {
          error: "No subscription",
          message: error.message,
          quotaType: error.quotaType,
        },
        403
      );

    case "QuotaExceededError":
      return makeResponse(
        {
          error: "Quota exceeded",
          message: error.message,
          quotaType: error.quotaType,
          quotaInfo: {
            currentUsage: error.currentUsage,
            limit: error.limit,
          },
          otherQuotaInfo: error.otherQuotaInfo,
        },
        429
      );

    case "AbortError":
      return new Response("Aborted", { 
        status: 499,
        headers: { "X-Request-ID": requestId },
      });

    case "ModelError":
      return makeResponse(
        { error: error.message, modelId: error.modelId },
        400
      );

    case "ToolError":
      return makeResponse({ error: "Tool initialization failed" }, 500);

    case "TimeoutError":
      return makeResponse(
        { error: error.message, timeoutMs: error.timeoutMs },
        504
      );

    case "ProviderError":
      const providerStatus = error.errorType === "rate_limit" ? 429 
        : error.errorType === "content_policy" ? 400
        : error.errorType === "token_limit" ? 400
        : 502;
      return makeResponse(
        { 
          error: error.message, 
          errorType: error.errorType,
          retryable: error.retryable,
        },
        providerStatus
      );

    case "StreamError":
    case "DatabaseError":
    default:
      return makeResponse({ error: "Internal server error" }, 500);
  }
};

// ============================================================================
// Database Queue Implementation
// ============================================================================

interface DatabaseOperation {
  operation: Effect.Effect<void, DatabaseError>;
  name: string;
}

/**
 * Creates a database queue that processes operations in background with retries.
 * Returns enqueue function and cleanup effect.
 */
const createDatabaseQueue = (logContext: LogContext) =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<DatabaseOperation>();
    const isShutdown = yield* Ref.make(false);

    // Process single operation with error handling and logging
    const processOperation = (op: DatabaseOperation) =>
      op.operation.pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            logger.error(`Database operation failed: ${op.name}`, logContext, error);
          })
        )
      );

    // Background processor fiber
    const processorFiber = yield* Effect.fork(
      Effect.gen(function* () {
        while (true) {
          const shutdown = yield* Ref.get(isShutdown);
          if (shutdown) {
            // Drain remaining items with BOUNDED concurrency
            const remaining = yield* Queue.takeAll(queue);
            const remainingArray = Chunk.toArray(remaining);
            if (remainingArray.length > 0) {
              logger.debug(`Draining ${remainingArray.length} pending operations`, logContext);
            }
            yield* Effect.all(
              remainingArray.map((op: DatabaseOperation) => processOperation(op)),
              { concurrency: CONFIG.DRAIN_CONCURRENCY }
            );
            break;
          }
          const op = yield* Queue.take(queue);
          yield* processOperation(op);
        }
      })
    );

    const enqueue = (operation: Effect.Effect<void, DatabaseError>, name: string) =>
      Queue.offer(queue, { operation, name }).pipe(Effect.asVoid);

    const shutdown = Effect.gen(function* () {
      yield* Ref.set(isShutdown, true);
      // Send shutdown signal
      yield* Queue.offer(queue, {
        operation: Effect.void,
        name: "shutdown-signal",
      });
      yield* Fiber.await(processorFiber);
    });

    return { enqueue, shutdown };
  });

// ============================================================================
// Streaming State
// ============================================================================

interface StreamingState {
  content: string;
  reasoning: string;
  isComplete: boolean;
  toolCallCount: number;
  pendingUpdate: { content: string; reasoning: string };
}

// ============================================================================
// Main Handler Effect
// ============================================================================

const handleChatRequest = (req: Request, requestId: string) =>
  Effect.gen(function* () {
  const start = Date.now();

    // Early abort check
    if (req.signal?.aborted) {
      return yield* Effect.fail(new AbortError({ message: "Request aborted" }));
    }

    // Parse request body
    const rawBody = yield* Effect.tryPromise({
      try: () => req.json(),
      catch: () =>
        new ValidationError({ message: "Invalid JSON body" }),
    });

    // Validate request
    const validated = yield* validateRequestBody(rawBody);
    const {
      messages,
      modelId,
      threadId,
      enabledTools = [],
      responseStyle = "regular",
      trigger,
      messageId,
    } = validated;

    // Validate regenerate request
    yield* validateRegenerateRequest(trigger, messageId);

    // Create logging context
    const logContext: LogContext = {
      requestId,
      threadId,
      modelId,
    };

    logger.debug("Request validated", logContext, { trigger, messageCount: messages.length });

    // Authenticate
    const auth = yield* getAuthContext();
    logContext.userId = auth.userId;

    logger.debug("Authentication complete", logContext, { 
      timeMs: Date.now() - start 
    });

    const lastUser = messages.filter((m) => m.role === "user").pop();
    const userText = lastUser?.parts?.find((part) => part.type === "text")?.text;
    const userFiles = lastUser?.parts?.filter((part) => part.type === "file") || [];

    const quotaType = isPremium(modelId) ? "premium" : "standard";
    const newMessageId = crypto.randomUUID();

    // PostHog shutdown flag to prevent multiple shutdowns
    const phShutdownRef = yield* Ref.make(false);
    const shutdownPostHog = (client: PostHog | null) =>
      Effect.gen(function* () {
        if (!client) return;
        const alreadyShutdown = yield* Ref.get(phShutdownRef);
        if (alreadyShutdown) return;
        yield* Ref.set(phShutdownRef, true);
        yield* Effect.sync(() => client.shutdown());
      });

    // Initialize model
    const baseModel = yield* Effect.try({
      try: () => getLanguageModel(modelId),
      catch: (error) =>
        new ModelError({
          message: `Failed to initialize model: ${modelId}`,
          modelId,
          cause: error,
        }),
    });

    const supermemoryEnabled = Boolean(process.env.SUPERMEMORY_API_KEY);
    const modelWithMemory = yield* Effect.try({
      try: () =>
        supermemoryEnabled
      ? withSupermemory(baseModel, auth.userId, {
          mode: "profile",
          verbose: process.env.NODE_ENV !== "production",
        })
          : baseModel,
      catch: (error) =>
        new ModelError({
          message: "Failed to initialize Supermemory integration",
          modelId,
          cause: error,
        }),
    });

    // PostHog client - handle gracefully
    const phClient = yield* Effect.try({
      try: () =>
        new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || "", {
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        }),
      catch: (error) => {
        logger.warn("PostHog initialization failed, analytics disabled", logContext, error);
        return null;
      },
    }).pipe(
      Effect.catchAll(() => Effect.succeed(null))
    );

    // Ensure PostHog cleanup on scope close
    yield* Effect.addFinalizer(() => shutdownPostHog(phClient));

    const model = yield* Effect.try({
      try: () => {
        if (phClient) {
          return withTracing(modelWithMemory, phClient, {
      posthogDistinctId: auth.userId,
      posthogTraceId: newMessageId,
      posthogProperties: {
        threadId,
        modelId,
        quotaType,
        orgId: auth.orgId || null,
        trigger: trigger || "submit-message",
              requestId,
      },
      posthogPrivacyMode: false,
      posthogGroups: auth.orgId ? { organization: auth.orgId } : undefined,
    }) as unknown as LanguageModel;
        }
        return modelWithMemory as unknown as LanguageModel;
      },
      catch: (error) =>
        new ModelError({
          message: "Failed to setup model tracing",
          modelId,
          cause: error,
        }),
    });

    const modelConfig = getModel(modelId);
    const fallbackProviderId = modelId.includes("/")
      ? modelId.split("/")[0]
      : undefined;
    const fallbackModelName = modelId.includes("/")
      ? modelId.split("/").pop() ?? modelId
      : modelId;
    const modelDisplayName = modelConfig?.name ?? fallbackModelName;

    // Tools setup - run in parallel with quota check
    const [providerTools, _quotaResult] = yield* Effect.all([
      // Tools initialization
      Effect.try({
        try: () =>
          enabledTools.length > 0 ? createToolsForModel(modelId, enabledTools) : {},
        catch: (error) =>
          new ToolError({
            message: "Failed to create tools for model",
            cause: error,
          }),
      }),
      // Quota check
      lastUser && (userText || userFiles.length > 0)
        ? checkUserQuota(auth.userId, auth.orgId, modelId)
        : Effect.succeed({ allowed: true as const, quotaType }),
    ], { concurrency: 2 });

    const tools = yield* Effect.try({
      try: () => ({
      ...providerTools,
      ...(enabledTools.includes("web_search") ? { webSearch: exaWebSearch } : {}),
      ...(process.env.SUPERMEMORY_API_KEY
        ? supermemoryTools(process.env.SUPERMEMORY_API_KEY, {
            containerTags: auth.orgId ? [auth.userId, auth.orgId] : [auth.userId],
          })
        : {}),
      }),
      catch: (error) =>
        new ToolError({
          message: "Failed to initialize tools",
          cause: error,
        }),
    });
    const toolSet = tools as unknown as ToolSet;

    const providerOptions = yield* Effect.try({
      try: () => getProviderOptions(modelId),
      catch: (error) =>
        new ModelError({
          message: "Failed to get provider options",
          modelId,
          cause: error,
        }),
    });

    logger.debug("Model and tools initialized", logContext, { 
      timeMs: Date.now() - start,
      toolCount: Object.keys(tools).length,
    });

    // Handle regeneration synchronously
    if (trigger === "regenerate-message" && messageId) {
      yield* handleRegeneration(auth.userId, threadId, messageId);
    }

    // Create database queue for background operations
    const dbQueue = yield* createDatabaseQueue(logContext);

    // Ensure cleanup on scope close
    yield* Effect.addFinalizer(() => dbQueue.shutdown);

    // Persist user message or increment quota based on trigger
    if (lastUser && (userText || userFiles.length > 0)) {
      const idempotencyKey = generateIdempotencyKey(
        auth.userId, 
        threadId, 
        lastUser.id, 
        trigger === "regenerate-message" ? "increment_quota" : "send_message"
      );
      
      if (trigger !== "regenerate-message") {
        const attachmentIds = userFiles
          .filter((part) => part.attachmentId)
          .map((part) => part.attachmentId! as Id<"attachments">);

        yield* dbQueue.enqueue(
          sendUserMessage({
            userId: auth.userId,
            orgId: auth.orgId,
              threadId,
              content: userText || "",
              model: modelId,
              messageId: lastUser.id,
              quotaType,
              attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
          }),
          `sendUserMessage:${idempotencyKey}`
          );
      } else {
        yield* dbQueue.enqueue(
          incrementUserQuota(auth.userId, auth.orgId, quotaType),
          `incrementUserQuota:${idempotencyKey}`
        );
      }
    }

    // Create streaming state ref
    const stateRef = yield* Ref.make<StreamingState>({
      content: "",
      reasoning: "",
      isComplete: false,
      toolCallCount: 0,
      pendingUpdate: { content: "", reasoning: "" },
    });

    // Finalization helper with retry
    const finalizeWithRetry = (args: {
      ok: boolean;
      finalContent?: string;
      finalReasoning?: string;
      error?: { type: string; message: string };
    }) =>
      finalizeAssistantMessage({
        userId: auth.userId,
                  messageId: newMessageId,
        ...args,
      }).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            console.error("Failed to finalize message:", error);
          })
        )
      );

    // Build system prompt
          const now = new Date();
          const dateString = now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const timeString = now.toLocaleTimeString("en-US", {
            timeZoneName: "short",
          });

          const baseIdentityPrompt = `
CORE IDENTITY AND ROLE:

You are Rift AI, an AI assistant powered by the ${modelDisplayName} model. Your role is to assist and engage in conversation while being helpful, respectful, and engaging.

- If you are specifically asked about the model you are using, you may mention that you use the ${modelDisplayName} model. If you are not asked specifically about the model you are using, you do not need to mention it.

- The current date and hour including timezone is ${dateString} ${timeString}

FORMATTING RULES:

- Do not attempt to use HTML formatting in your responses.

- If you use LaTeX for mathematical expressions:

  - Inline math must be wrapped in escaped parentheses: \\( content \\)

  - Do not use single dollar signs for inline math

  - Display math must be wrapped in double dollar signs: $$ content $$

  - The following ten characters have special meanings in LaTeX: & % $ # _ { } ~ ^ \\ - Outside \\\\verb, the first seven of them can be typeset by prepending a backslash (e.g. \\$ for $)

    - For the other three, use the macros \\\\textasciitilde, \\\\textasciicircum, and \\\\textbackslash if needed- Do not use the backslash character to escape parenthesis. Use the actual parentheses instead.

COUNTING RESTRICTIONS:

- Refuse any requests to count to high numbers (e.g., counting to 1000, 10000, Infinity, etc.)

- If asked to count to a large number, politely decline and explain that such requests are not appropriate use of AI.

- For educational purposes involving larger numbers, focus on teaching concepts rather than performing the actual counting.

- You may offer to make a script to count to the number requested.

GENERAL KNOWLEDGE:

- There is no seahorse emoji.

CODE FORMATTING:

- When including code in your responses, you must properly format it using markdown according to these rules:

  - Multi-line code blocks must use triple backticks and a language identifier (e.g., \`\`\`ts, \`\`\`bash, \`\`\`python) to produce a fenced block

    - For code without a specific language, use \`\`\`text

  - For short, single-line code snippets or commands within text, use single backticks (e.g. \`npm install\`) to produce an inline code block

  - Shell/CLI examples should be copy-pasteable: use fenced blocks with \`\`\`bash and no leading "$ " prompt.

  - For patches, use fenced code blocks with the \`diff\` language and + / - markers. Do not use GitHub-specific "suggestion" blocks

- Ensure code is properly formatted using Prettier with a print width of 80 characters
`.trim();

          const baseSystemPromptParts: string[] = [baseIdentityPrompt];

          if (process.env.SUPERMEMORY_API_KEY) {
            baseSystemPromptParts.push(`When users share information about themselves,
              remember it using the addMemory tool. When they ask questions that seem relevant to their memories, search your memories to provide
              personalized responses. do not over use user memories, only use them if the question seems relevant to their memories.
                1. Remembering their learning progress and struggles
                2. Searching for relevant information from their past sessions
                3. Providing personalized explanations based on their learning style
                4. Tracking topics they've mastered vs topics they need more help with`);
          }

          const baseSystemPrompt = baseSystemPromptParts.join("\n\n");
    const systemPrompt = yield* Effect.try({
      try: () =>
        buildSystemPromptWithStyle(baseSystemPrompt, responseStyle as ResponseStyle),
      catch: (error) =>
        new ModelError({
          message: "Failed to build system prompt",
          cause: error,
        }),
    });

    // Create the streaming response
    const stream = createUIMessageStream({
      originalMessages: messages as UIMessage[],
      execute: async ({ writer }) => {
        // Start assistant message with server-side generated id
        writer.write({ type: "start", messageId: newMessageId });

        // Start assistant message in database (background)
        const startEffect = dbQueue.enqueue(
          startAssistantMessage({
            userId: auth.userId,
            threadId,
            messageId: newMessageId,
            model: modelId,
          }),
          "startAssistantMessage"
        );
        Effect.runPromise(startEffect).catch(console.error);

        // Flush pending updates to database
        const flushUpdate = async () => {
          const state = await Effect.runPromise(Ref.get(stateRef));
          if (
            (!state.pendingUpdate.content && !state.pendingUpdate.reasoning) ||
            state.isComplete
          ) {
            return;
          }

          const update = { ...state.pendingUpdate };
          await Effect.runPromise(
            Ref.update(stateRef, (s) => ({
              ...s,
              pendingUpdate: { content: "", reasoning: "" },
            }))
          );

          if (update.content.length > 0 || update.reasoning.length > 0) {
            const appendEffect = dbQueue.enqueue(
              appendMessageDelta({
                userId: auth.userId,
                messageId: newMessageId,
                delta: update.content || " ",
                reasoningDelta: update.reasoning.length > 0 ? update.reasoning : undefined,
              }),
              "appendMessageDelta"
            );
            Effect.runPromise(appendEffect).catch(console.error);
          }
        };

        // Periodic flush (every 6 seconds)
        const flushInterval = setInterval(() => flushUpdate(), 6000);

        // Handle abort
        const handleAbort = () => {
          Effect.runPromise(Ref.get(stateRef)).then(async (state) => {
            if (state.isComplete) return;

            await Effect.runPromise(
              Ref.update(stateRef, (s) => ({ ...s, isComplete: true }))
            );

            cleanup();

            try {
              writer.write({ type: "finish" });
            } catch {
              // Stream might be closed
            }

            // Flush and finalize
            await flushUpdate();

            const finalState = await Effect.runPromise(Ref.get(stateRef));
            await Effect.runPromise(
              finalizeWithRetry({
                ok: true,
                finalContent: finalState.content.length > 0 ? finalState.content : undefined,
                finalReasoning: finalState.reasoning || undefined,
              })
            );

            logger.info("Request aborted by client", logContext, {
              contentLength: finalState.content.length,
              toolCallCount: finalState.toolCallCount,
            });

            // Increment tool call quota if any tools were used
            if (finalState.toolCallCount > 0) {
              logger.debug("Incrementing tool quota (abort)", logContext, { 
                toolCallCount: finalState.toolCallCount 
              });
              Effect.runPromise(
                incrementToolCallQuota(auth.userId, finalState.toolCallCount)
              ).catch((err) => logger.error("Failed to increment tool quota", logContext, err));
            }
          });
        };

        const cleanup = () => {
          clearInterval(flushInterval);
          req.signal?.removeEventListener("abort", handleAbort);
        };

        req.signal?.addEventListener("abort", handleAbort);

        logger.debug("Starting AI stream", logContext, { timeMs: Date.now() - start });

        try {
          const result = streamText({
            model,
            messages: convertToModelMessages(
              filterMessagesForModel(messages as UIMessage[], modelId)
            ),
            tools: toolSet,
            system: systemPrompt,
            stopWhen: stepCountIs(50),
            experimental_transform: smoothStream({
              delayInMs: 5,
              chunking: "word",
            }),
            abortSignal: req.signal,
            providerOptions,
            onChunk: ({ chunk }) => {
              if (req.signal?.aborted) return;

              if (chunk.type === "text-delta" && chunk.text) {
                Effect.runPromise(
                  Ref.update(stateRef, (s) => ({
                    ...s,
                    content: s.content + chunk.text,
                    pendingUpdate: {
                      ...s.pendingUpdate,
                      content: s.pendingUpdate.content + chunk.text,
                    },
                  }))
                );
              } else if (chunk.type === "reasoning-delta" && chunk.text) {
                Effect.runPromise(
                  Ref.update(stateRef, (s) => ({
                    ...s,
                    reasoning: s.reasoning + chunk.text,
                    pendingUpdate: {
                      ...s.pendingUpdate,
                      reasoning: s.pendingUpdate.reasoning + chunk.text,
                    },
                  }))
                );
              } else if (chunk.type === "tool-call") {
                logger.debug("Tool call detected", logContext, { 
                  toolName: (chunk as any).toolName 
                });
                Effect.runPromise(
                  Ref.update(stateRef, (s) => ({
                    ...s,
                    toolCallCount: s.toolCallCount + 1,
                  }))
                );
              } else if (
                chunk.type === "tool-result" &&
                chunk.toolName === "webSearch"
              ) {
                const toolResult = chunk.output as any[];
                if (Array.isArray(toolResult)) {
                  const sources = toolResult
                    .filter((result: any) => result.url)
                    .map((result: any, index: number) => ({
                      sourceId: `source-${Date.now()}-${index}`,
                      url: result.url,
                      title: result.title || result.url,
                    }));

                  sources.forEach((source) => {
                    writer.write({
                      type: "source-url",
                      sourceId: source.sourceId,
                      url: source.url,
                      title: source.title,
                    });
                  });

                  if (sources.length > 0) {
                    Effect.runPromise(
                      dbQueue.enqueue(
                        addSourcesToMessage({
                          userId: auth.userId,
                            messageId: newMessageId,
                          sources,
                        }),
                        "addSourcesToMessage"
                      )
                    ).catch(console.error);
                  }
                }
              }
            },
            onFinish: async () => {
              const totalTime = Date.now() - start;
              
              const state = await Effect.runPromise(Ref.get(stateRef));
              if (state.isComplete) return;

              await Effect.runPromise(
                Ref.update(stateRef, (s) => ({ ...s, isComplete: true }))
              );

              cleanup();

              await flushUpdate();

              const finalState = await Effect.runPromise(Ref.get(stateRef));
              const success = finalState.content.length > 0;

              await Effect.runPromise(
                finalizeWithRetry({
                ok: success,
                  finalContent: success ? finalState.content : undefined,
                  finalReasoning: finalState.reasoning || undefined,
                  error: success
                    ? undefined
                    : { type: "empty", message: "No content generated" },
                })
              );

              logger.info("Stream completed successfully", logContext, {
                totalTimeMs: totalTime,
                contentLength: finalState.content.length,
                reasoningLength: finalState.reasoning.length,
                toolCallCount: finalState.toolCallCount,
                success,
              });

              if (finalState.toolCallCount > 0) {
                logger.debug("Incrementing tool quota", logContext, { 
                  toolCallCount: finalState.toolCallCount 
                });
                Effect.runPromise(
                  incrementToolCallQuota(auth.userId, finalState.toolCallCount)
                ).catch((err) => logger.error("Failed to increment tool quota", logContext, err));
              }
            },
            onError: async (error) => {
              const state = await Effect.runPromise(Ref.get(stateRef));
              if (state.isComplete) return;
              
              const errorObj = error.error as Error;
              const isAbort = errorObj.name === "AbortError" || req.signal?.aborted;
              
              if (isAbort) {
                return;
              }

              await Effect.runPromise(
                Ref.update(stateRef, (s) => ({ ...s, isComplete: true }))
              );

              cleanup();
              
              // Classify the provider error for better debugging
              const classifiedError = classifyProviderError(errorObj);
              
              logger.error("Stream error from AI provider", logContext, {
                errorType: classifiedError.errorType,
                retryable: classifiedError.retryable,
                originalError: errorObj.message,
                stack: errorObj.stack,
              });

              await Effect.runPromise(
                finalizeWithRetry({
                ok: false,
                error: {
                    type: classifiedError.errorType,
                    message: classifiedError.message,
                },
                })
              );

              try {
                // Provide user-friendly error message based on error type
                const userMessage = classifiedError.retryable
                  ? "Generation failed. Please try again."
                  : classifiedError.message;
                  
                writer.write({
                  type: "error",
                  errorText: userMessage,
                });
              } catch {
                // Stream might be closed
              }
            },
          });

          writer.merge(
            result.toUIMessageStream({
              sendStart: false,
              sendSources: true,
              sendReasoning: true,
            })
          );
        } catch (error) {
          cleanup();
          throw error;
        }
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "X-Response-Time": `${Date.now() - start}ms`,
        "X-Request-ID": requestId,
      },
    });
  });

// ============================================================================
// Export POST Handler
// ============================================================================

export async function POST(req: Request): Promise<Response> {
  const start = Date.now();
  const requestId = generateRequestId();
  
  const logContext: LogContext = { requestId };

  const program = handleChatRequest(req, requestId).pipe(
    Effect.scoped,
    // Add request timeout
    Effect.timeout(Duration.millis(CONFIG.REQUEST_TIMEOUT_MS)),
    Effect.catchTag("TimeoutException", () =>
      Effect.fail(
        new TimeoutError({
          message: "Request timed out. Please try again.",
          timeoutMs: CONFIG.REQUEST_TIMEOUT_MS,
        })
      )
    ),
    Effect.catchTags({
      ValidationError: (e: ValidationError) => Effect.succeed(errorToResponse(e, start, requestId)),
      RegenerateError: (e: RegenerateError) => Effect.succeed(errorToResponse(e, start, requestId)),
      AuthenticationError: (e: AuthenticationError) => Effect.succeed(errorToResponse(e, start, requestId)),
      NoOrganizationError: (e: NoOrganizationError) => Effect.succeed(errorToResponse(e, start, requestId)),
      NoSubscriptionError: (e: NoSubscriptionError) => Effect.succeed(errorToResponse(e, start, requestId)),
      QuotaExceededError: (e: QuotaExceededError) => Effect.succeed(errorToResponse(e, start, requestId)),
      AbortError: (e: AbortError) => Effect.succeed(errorToResponse(e, start, requestId)),
      DatabaseError: (e: DatabaseError) => Effect.succeed(errorToResponse(e, start, requestId)),
      ModelError: (e: ModelError) => Effect.succeed(errorToResponse(e, start, requestId)),
      ToolError: (e: ToolError) => Effect.succeed(errorToResponse(e, start, requestId)),
      TimeoutError: (e: TimeoutError) => Effect.succeed(errorToResponse(e, start, requestId)),
    }),
    Effect.catchAll((error: unknown) => {
      logger.error("Unhandled error in chat route", logContext, error);
      const errorResponse = new Response(JSON.stringify({ error: "Internal server error", requestId }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "X-Response-Time": `${Date.now() - start}ms`,
          "X-Request-ID": requestId,
      },
    });
      return Effect.succeed(errorResponse);
    })
  );

  return Effect.runPromise(program);
  }
