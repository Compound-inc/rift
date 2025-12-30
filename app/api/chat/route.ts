import { Cause, Duration, Effect, Fiber, Ref, Scope } from "effect";
// import { checkBotId } from "botid/server";
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
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { withTracing } from "@posthog/ai";
import { PostHog } from "posthog-node";
import * as Sentry from "@sentry/nextjs";
// import { withSupermemory, supermemoryTools } from "@supermemory/tools/ai-sdk";
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

export const maxDuration = 500;

import {
  ValidationError,
  AuthenticationError,
  NoOrganizationError,
  NoSubscriptionError,
  QuotaExceededError,
  DatabaseError,
  AbortError,
  RegenerateError,
  ModelError,
  ToolError,
  TimeoutError,
  ProviderError,
  // BotDetectionError,
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
  checkAborted,
  fromAbortSignal,
  validateThreadAndInstruction,
  captureChatError,
} from "./services";
import { buildSystemPrompt } from "./system-prompt";
import { createDatabaseQueue } from "./database-queue";

// ============================================================================
// Request ID Generation
// ============================================================================

const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
};

// ============================================================================
// App Attribution Headers
// ============================================================================

const defaultSiteUrl = "https://rift.mx";

const getAttributionHeaders = (): Record<string, string> => {
  const deploymentDomain =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  const referer = deploymentDomain
    ? deploymentDomain.startsWith("http")
      ? deploymentDomain
      : `https://${deploymentDomain}`
    : defaultSiteUrl;

  return {
    "http-referer": referer,
    "x-title": "Rift",
  };
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
  requestId: string,
  logContext: LogContext
): Response => {
  captureChatError(error, logContext);

  const baseHeaders = {
    "Content-Type": "application/json",
    "X-Response-Time": `${Date.now() - start}ms`,
    "X-Request-ID": requestId,
  };

  const makeResponse = (body: object, status: number, errorCode: string) =>
    new Response(JSON.stringify({ ...body, errorCode, requestId }), {
      status,
      headers: baseHeaders,
    });

  switch (error._tag) {
    case "ValidationError":
      return makeResponse({ error: error.message, field: error.field }, 400, "VALIDATION_ERROR");

    case "RegenerateError":
      return makeResponse({ error: error.message }, 400, "REGENERATE_ERROR");

    case "AuthenticationError":
      return makeResponse({ error: error.message }, 401, "AUTH_ERROR");

    case "NoOrganizationError":
      return makeResponse({ error: error.message }, 403, "NO_ORGANIZATION");

    case "NoSubscriptionError":
      return makeResponse(
        {
          error: "No subscription",
          message: error.message,
          quotaType: error.quotaType,
        },
        403,
        "NO_SUBSCRIPTION"
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
        429,
        "QUOTA_EXCEEDED"
      );

    case "AbortError":
      return new Response(JSON.stringify({ errorCode: "ABORTED", requestId }), {
        status: 499,
        headers: baseHeaders,
      });

    case "ModelError":
      logger.error(`Model error: ${error.message}`, logContext, { 
        modelId: error.modelId,
        cause: error.cause 
      });
      return makeResponse(
        { error: error.message, modelId: error.modelId },
        400,
        "MODEL_ERROR"
      );

    case "ToolError":
      logger.error(`Tool error: ${error.message}`, logContext, { cause: error.cause });
      return makeResponse(
        { error: "Tool initialization failed" },
        500,
        "TOOL_ERROR"
      );

    case "TimeoutError":
      return makeResponse(
        { error: error.message, timeoutMs: error.timeoutMs },
        504,
        "TIMEOUT"
      );

    case "BotDetectionError":
      return makeResponse(
        { error: error.message, reason: error.reason },
        403,
        "BOT_DETECTED"
      );

    case "ProviderError":
      const providerStatus =
        error.errorType === "rate_limit"
          ? 429
          : error.errorType === "content_policy"
            ? 400
            : error.errorType === "token_limit"
              ? 400
              : 502;
      
      // Log provider errors appropriately
      if (providerStatus >= 500) {
        logger.error(`Provider error: ${error.message}`, logContext, { 
          errorType: error.errorType,
          cause: error.cause 
        });
      } else {
        logger.warn(`Provider error: ${error.message}`, logContext, {
          errorType: error.errorType
        });
      }

      return makeResponse(
        {
          error: error.message,
          errorType: error.errorType,
          retryable: error.retryable,
        },
        providerStatus,
        "PROVIDER_ERROR"
      );

    case "DatabaseError":
      logger.error(`Database error: ${error.message}`, logContext, { 
        operation: error.operation,
        cause: error.cause 
      });
      return makeResponse({ error: error.message }, 500, "DATABASE_ERROR");

    default:
      logger.error(`Unknown error type`, logContext, { error });
      return makeResponse({ error: "Internal server error" }, 500, "INTERNAL_ERROR");
  }
};

/*
 * Runs BotID verification and fails the effect when the request is classified as a bot.
const verifyBotProtection = (logContext: LogContext) =>
  Effect.tryPromise({
    try: () => checkBotId(),
    catch: (error) =>
      new BotDetectionError({
        message: "Bot verification failed",
        reason: error instanceof Error ? error.message : "Unknown error",
      }),
  }).pipe(
    Effect.flatMap((verification) => {
      if (verification.isBot) {
        const reason = "BotID classification";
        logger.warn("Bot traffic blocked", logContext, { reason });
        return Effect.fail(
          new BotDetectionError({
            message: "Bot detected. Access denied.",
            reason,
          })
        );
      }
      return Effect.succeed(verification);
    })
  );
*/

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

const handleChatRequest = (
  req: Request,
  requestId: string
): Effect.Effect<Response, ChatRouteError, Scope.Scope> =>
  Effect.gen(function* () {
  const start = Date.now();
    const logContext: LogContext = { requestId };

    // yield* verifyBotProtection(logContext);

    // Early abort check (Effect-based)
    yield* checkAborted(req.signal);

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
      customInstructionId,
      trigger,
      messageId,
    } = validated;

    // Validate regenerate request
    yield* validateRegenerateRequest(trigger, messageId);

    logContext.threadId = threadId;
    logContext.modelId = modelId;

    logger.debug("Request validated", logContext, { trigger, messageCount: messages.length });

    // Authenticate
    const auth = yield* getAuthContext();
    logContext.userId = auth.userId;

    logger.debug("Authentication complete", logContext, { 
      timeMs: Date.now() - start 
    });

    // Validate thread ownership and custom instruction access
    const { thread, customInstruction } = yield* validateThreadAndInstruction(
      auth.userId,
      auth.orgId,
      threadId,
      customInstructionId
    );

    if (!thread) {
      return yield* new ValidationError({
        message: "Thread not found or access denied",
        field: "threadId",
      });
    }

    const customInstructionsContent = customInstruction?.instructions;
    const validatedCustomInstructionId = customInstruction ? customInstructionId : undefined;

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

    // const supermemoryEnabled = Boolean(process.env.SUPERMEMORY_API_KEY);
    // const modelWithMemory = yield* Effect.try({
    //   try: () =>
    //     supermemoryEnabled
    //   ? withSupermemory(baseModel, auth.userId, {
    //       mode: "profile",
    //       verbose: process.env.NODE_ENV !== "production",
    //     })
    //       : baseModel,
    //   catch: (error) =>
    //     new ModelError({
    //       message: "Failed to initialize Supermemory integration",
    //       modelId,
    //       cause: error,
    //     }),
    // });
    const modelWithMemory = baseModel;

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
      // ...(process.env.SUPERMEMORY_API_KEY
      //   ? supermemoryTools(process.env.SUPERMEMORY_API_KEY, {
      //       containerTags: auth.orgId ? [auth.userId, auth.orgId] : [auth.userId],
      //     })
      //   : {}),
      }),
      catch: (error) =>
        new ToolError({
          message: "Failed to initialize tools",
          cause: error,
        }),
    });
    const toolSet = tools as unknown as ToolSet;
    const hasTools = Object.keys(tools).length > 0;

    const providerOptions = yield* Effect.try({
      try: () => getProviderOptions(modelId, hasTools),
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

        // Run synchronously to ensure user message is saved before AI generation starts
        yield* sendUserMessage({
          userId: auth.userId,
          orgId: auth.orgId,
              threadId,
              content: userText || "",
              model: modelId,
              messageId: lastUser.id,
              quotaType,
              attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              logger.error(`Failed to save user message: ${idempotencyKey}`, logContext, error);
            })
          )
        );
      } else {
        // Run synchronously for regeneration quota increment
        yield* incrementUserQuota(auth.userId, auth.orgId, quotaType).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              logger.error(`Failed to increment quota: ${idempotencyKey}`, logContext, error);
            })
          )
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
    const queueShutdownRef = yield* Ref.make(false);

    // Finalization helper
    const finalize = (args: {
      ok: boolean;
      finalContent?: string;
      finalReasoning?: string;
      error?: { type: string; message: string };
    }) =>
      Effect.gen(function* () {
        return yield* finalizeAssistantMessage({
          userId: auth.userId,
          threadId,
          messageId: newMessageId,
          ...args,
        });
      }).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            logger.error("Failed to finalize message", logContext, error);
          })
        )
      );

    const shutdownQueue = (reason: string) =>
      Effect.gen(function* () {
        const alreadyShutdown = yield* Ref.get(queueShutdownRef);
        if (alreadyShutdown) return;
        yield* Ref.set(queueShutdownRef, true);
        yield* dbQueue.shutdown;
      }).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            logger.error("Failed to shutdown dbQueue", { ...logContext, reason }, error);
          })
        )
      );

    // Build system prompt
    const systemPrompt = yield* buildSystemPrompt({
      modelDisplayName,
      customInstructions: customInstructionsContent,
      // supermemoryEnabled,
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
        Effect.runPromise(startEffect).catch((err) => 
          logger.error("Failed to enqueue startAssistantMessage", logContext, err)
        );

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
            Effect.runPromise(appendEffect).catch((err) => 
              logger.error("Failed to enqueue appendMessageDelta", logContext, err)
            );
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
              finalize({
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
              try {
                await Effect.runPromise(
                  incrementToolCallQuota(auth.userId, finalState.toolCallCount)
                );
              } catch (err) {
                logger.error("Failed to increment tool quota", logContext, err);
              }
            }

            await Effect.runPromise(shutdownQueue("abort"));
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
            headers: getAttributionHeaders(),
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
                  toolName: chunk.toolName,
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
                    ).catch((err) => 
                      logger.error("Failed to enqueue addSourcesToMessage", logContext, err)
                    );
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
                finalize({
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
                try {
                  await Effect.runPromise(
                    incrementToolCallQuota(auth.userId, finalState.toolCallCount)
                  );
                } catch (err) {
                  logger.error("Failed to increment tool quota", logContext, err);
                }
              }

              if (validatedCustomInstructionId) {
                try {
                  await fetchMutation(api.customInstructions.serverIncrementUsage, {
                    id: validatedCustomInstructionId as Id<"customInstructions">,
                    secret: process.env.CONVEX_SECRET_TOKEN!,
                  });
                } catch (err) {
                  logger.warn("Failed to increment custom instruction usage", logContext, err);
                }
              }

              await Effect.runPromise(shutdownQueue("finish"));
            },
            onError: async (error) => {
              const state = await Effect.runPromise(Ref.get(stateRef));
              if (state.isComplete) return;

              await Effect.runPromise(
                Ref.update(stateRef, (s) => ({ ...s, isComplete: true }))
              );

              cleanup();
              
              const errorObj = error.error as Error;
              const isAbort = errorObj.name === "AbortError" || req.signal?.aborted;
              
              if (isAbort) {
                // Finalize as successful abort
                const finalState = await Effect.runPromise(Ref.get(stateRef));
                await Effect.runPromise(
                  finalize({
                    ok: true,
                    finalContent: finalState.content.length > 0 ? finalState.content : undefined,
                    finalReasoning: finalState.reasoning || undefined,
                  })
                ).catch((err) => logger.error("Failed to finalize on abort", logContext, err));
                
                logger.info("Stream aborted", logContext, { contentLength: finalState.content.length });
                await Effect.runPromise(shutdownQueue("abort-signal"));
                return;
              }

              // Classify the provider error for better debugging
              const classifiedError = classifyProviderError(errorObj);
              
              captureChatError(classifiedError, logContext);
              
              logger.error("Stream error from AI provider", logContext, {
                errorType: classifiedError.errorType,
                retryable: classifiedError.retryable,
                originalError: errorObj.message,
                stack: errorObj.stack,
              });

              await Effect.runPromise(
                finalize({
                ok: false,
                error: {
                    type: classifiedError.errorType,
                    message: classifiedError.message,
                },
                })
              ).catch((err) => logger.error("Failed to finalize on error", logContext, err));

              await Effect.runPromise(shutdownQueue("error"));

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
          
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          logger.error("Stream execution error", logContext, error);
          
          // Capture execution error to Sentry
          try {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            Sentry.captureException(errorObj, {
              tags: {
                error_type: "stream_execution_error",
                request_id: requestId,
              },
              extra: logContext,
            });
          } catch (sentryError) {
            console.error("Failed to capture stream execution error to Sentry", sentryError);
          }
          
          await Effect.runPromise(
            finalize({
              ok: false,
              error: { type: "execution_error", message: errorMessage },
            })
          ).catch((finalizeErr) => 
            logger.error("Failed to finalize on error", logContext, finalizeErr)
          );
          
          await Effect.runPromise(shutdownQueue("execute-catch"));
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

  const abortEffect = fromAbortSignal(req.signal);

  const program = Effect.gen(function* (_) {
    const mainFiber = yield* _(Effect.forkScoped(handleChatRequest(req, requestId)));

    // Interrupt the main fiber if the request is aborted.
    yield* _(
      abortEffect.pipe(
        Effect.catchAll(() => Fiber.interrupt(mainFiber)),
        Effect.forkScoped
      )
    );

    return yield* Fiber.join(mainFiber).pipe(
      Effect.catchAllCause((cause) =>
        Cause.isInterruptedOnly(cause)
          ? Effect.fail(new AbortError({ message: "Request aborted" }))
          : Effect.failCause(cause)
      )
    );
  }).pipe(
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
      ValidationError: (e: ValidationError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      RegenerateError: (e: RegenerateError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      AuthenticationError: (e: AuthenticationError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      // BotDetectionError: (e: BotDetectionError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      NoOrganizationError: (e: NoOrganizationError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      NoSubscriptionError: (e: NoSubscriptionError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      QuotaExceededError: (e: QuotaExceededError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      AbortError: (e: AbortError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      DatabaseError: (e: DatabaseError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      ModelError: (e: ModelError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      ToolError: (e: ToolError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      ProviderError: (e: ProviderError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
      TimeoutError: (e: TimeoutError) => Effect.succeed(errorToResponse(e, start, requestId, logContext)),
    }),
    Effect.catchAll((error: unknown) => {
      logger.error("Unhandled error in chat route", logContext, error);
      
      // Capture unknown errors to Sentry
      try {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        Sentry.captureException(errorObj, {
          tags: {
            error_type: "unhandled",
            request_id: requestId,
          },
          extra: logContext,
        });
      } catch (sentryError) {
        console.error("Failed to capture unhandled error to Sentry", sentryError);
      }
      
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
