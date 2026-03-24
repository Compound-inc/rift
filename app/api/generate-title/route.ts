import { NextRequest, NextResponse } from "next/server";
import { generateText, type LanguageModel } from "ai";
import { Effect, Schedule, Duration, Data } from "effect";
import { fetchMutation } from "convex/nextjs";
import { withAuth } from "@workos-inc/authkit-nextjs";
// import { checkBotId } from "botid/server";
import { api } from "@/convex/_generated/api";
import { getLanguageModel } from "@/lib/ai/ai-providers";


export const maxDuration = 80;

// ============================================================================
// Configuration
// ============================================================================

const TITLE_GENERATION_MODEL = "meta-llama/llama-4-maverick";
const ROUTE_TIMEOUT = Duration.seconds(60);

// Retry with exponential backoff + jitter, up to 2 retries
const GENERATE_RETRY_SCHEDULE = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(2))
);

const MUTATION_RETRY_SCHEDULE = Schedule.exponential("150 millis").pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(2))
);

// ============================================================================
// Error Types
// ============================================================================

class AuthError extends Data.TaggedError("AuthError")<{
  readonly message: string;
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
}> {}

class ParseError extends Data.TaggedError("ParseError")<{
  readonly message: string;
}> {}

class ModelCallError extends Data.TaggedError("ModelCallError")<{
  readonly message: string;
}> {}

class MutationCallError extends Data.TaggedError("MutationCallError")<{
  readonly message: string;
}> {}

class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly message: string;
}> {}

/*
class BotDetectionError extends Data.TaggedError("BotDetectionError")<{
  readonly message: string;
  readonly reason?: string;
}> {}
*/

// ============================================================================
// Request ID Generation
// ============================================================================

const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `title_${timestamp}_${random}`;
};

// ============================================================================
// Response Helpers
// ============================================================================

type RouteError =
  | AuthError
  | ValidationError
  | ParseError
  | ModelCallError
  | MutationCallError
  | TimeoutError
  // | BotDetectionError;

const errorToResponse = (error: RouteError, requestId: string): NextResponse => {
  const headers = { "X-Request-ID": requestId };
  
  switch (error._tag) {
    case "AuthError":
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401, headers });
    case "ValidationError":
      return NextResponse.json({ error: error.message, requestId }, { status: 400, headers });
    case "ParseError":
      return NextResponse.json({ error: error.message, requestId }, { status: 400, headers });
    case "TimeoutError":
      return NextResponse.json({ error: error.message, requestId }, { status: 504, headers });
    // case "BotDetectionError":
    //   return NextResponse.json(
    //     { error: error.message, reason: error.reason, requestId },
    //     { status: 403, headers }
    //   );
    case "ModelCallError":
    case "MutationCallError":
      return NextResponse.json({ error: "Failed to generate title", requestId }, { status: 500, headers });
  }
};

// ============================================================================
// Text Processing
// ============================================================================

const trimUserMessage = (message: string): string =>
  message.length > 200 ? `${message.slice(0, 200)}...` : message;

const cleanGeneratedTitle = (text: string): string =>
  text
    .replace(/[#*_`"'~-]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(" ")
    .slice(0, 50);

// ============================================================================
// Effect Operations
// ============================================================================

type RequestBody = {
  threadId: string;
  userMessage: string;
};

const authenticate = Effect.gen(function* () {
  const authResult = yield* Effect.tryPromise({
    try: () => withAuth(),
    catch: () => new AuthError({ message: "Authentication failed" }),
  });

  if (!authResult.accessToken) {
    return yield* Effect.fail(new AuthError({ message: "No access token" }));
  }

  return authResult.accessToken;
});

const parseRequestBody = (request: NextRequest) =>
  Effect.tryPromise({
    try: () => request.json(),
    catch: () => new ParseError({ message: "Invalid JSON body" }),
  });

const validateRequestBody = (body: unknown): Effect.Effect<RequestBody, ValidationError> =>
  Effect.gen(function* () {
    if (body === null || typeof body !== "object") {
      return yield* Effect.fail(new ValidationError({ message: "Request body must be an object" }));
    }

    const { threadId, userMessage } = body as Partial<RequestBody>;

    if (typeof threadId !== "string" || threadId.length === 0) {
      return yield* Effect.fail(new ValidationError({ message: "Missing or invalid threadId" }));
    }

    if (typeof userMessage !== "string" || userMessage.length === 0) {
      return yield* Effect.fail(new ValidationError({ message: "Missing or invalid userMessage" }));
    }

    return { threadId, userMessage };
  });

const generateTitle = (trimmedMessage: string) =>
  Effect.tryPromise({
    try: () =>
      generateText({
        model: getLanguageModel(TITLE_GENERATION_MODEL),
        prompt: `You are an expert title generator. You are given a message and you need to generate a short title based on it.
        - you will generate a short 3-4 words title based on the first message a user begins a conversation with
        - the title should creative and unique
        - do not write anything other than the title
        - do not use quotes or colons
        - do not use any other text other than the title
        - the title should be in same language as the user message
        User message: ${trimmedMessage}`,
        temperature: 0.5,
        maxOutputTokens: 50,
      }),
    catch: (error) =>
      new ModelCallError({
        message: error instanceof Error ? error.message : "Failed to generate title",
      }),
  }).pipe(Effect.retry(GENERATE_RETRY_SCHEDULE));

const updateThreadTitle = (accessToken: string, threadId: string, title: string) =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(
        api.threads.autoUpdateThreadTitle,
        { threadId, title },
        { token: accessToken }
      ),
    catch: (error) =>
      new MutationCallError({
        message: error instanceof Error ? error.message : "Failed to update title",
      }),
  }).pipe(Effect.retry(MUTATION_RETRY_SCHEDULE));

/*
const verifyBotProtection = (requestId: string) =>
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
        console.warn(`[${requestId}] Bot traffic blocked`, reason);
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
// Main Handler
// ============================================================================

const handleRequest = (request: NextRequest, requestId: string) =>
  Effect.gen(function* () {
    // yield* verifyBotProtection(requestId);
    const accessToken = yield* authenticate;
    const rawBody = yield* parseRequestBody(request);
    const { threadId, userMessage } = yield* validateRequestBody(rawBody);

    const trimmedMessage = trimUserMessage(userMessage);
    const generation = yield* generateTitle(trimmedMessage);

    if (!generation.text) {
      return yield* Effect.fail(new ModelCallError({ message: "Model returned no text" }));
    }

    const cleanTitle = cleanGeneratedTitle(generation.text);
    const finalTitle = cleanTitle || "Nuevo Chat";

    yield* updateThreadTitle(accessToken, threadId, finalTitle);

    return NextResponse.json(
      { title: finalTitle, requestId },
      { headers: { "X-Request-ID": requestId } }
    );
  });

// ============================================================================
// Route Export
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();

  const program = handleRequest(request, requestId).pipe(
    Effect.timeout(ROUTE_TIMEOUT),
    Effect.catchTag("TimeoutException", () =>
      Effect.fail(new TimeoutError({ message: "Request timed out" }))
    ),
    Effect.catchTags({
      AuthError: (e: AuthError) => Effect.succeed(errorToResponse(e, requestId)),
      ValidationError: (e: ValidationError) => Effect.succeed(errorToResponse(e, requestId)),
      ParseError: (e: ParseError) => Effect.succeed(errorToResponse(e, requestId)),
      TimeoutError: (e: TimeoutError) => Effect.succeed(errorToResponse(e, requestId)),
      // BotDetectionError: (e: BotDetectionError) => Effect.succeed(errorToResponse(e, requestId)),
      ModelCallError: (e: ModelCallError) => Effect.succeed(errorToResponse(e, requestId)),
      MutationCallError: (e: MutationCallError) => Effect.succeed(errorToResponse(e, requestId)),
    }),
    Effect.catchAll((error: unknown) => {
      console.error(`[${requestId}] Unhandled error generating title:`, error);
      return Effect.succeed(
        NextResponse.json(
          { error: "Failed to generate title", requestId },
          { status: 500, headers: { "X-Request-ID": requestId } }
        )
      );
    })
  );

  return Effect.runPromise(program);
}
