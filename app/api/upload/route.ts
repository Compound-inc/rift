import { NextRequest, NextResponse } from "next/server";
import { Effect, Data, Schedule, Duration } from "effect";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logAttachmentUploaded } from "@/actions/audit";
import { checkRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Maximum file size in bytes (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Request timeout in milliseconds */
  TIMEOUT_MS: 150_000,
  /** Allowed MIME types */
  ALLOWED_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
  ] as const,
  /** Rate limit configuration for file uploads */
  RATE_LIMIT: {
    LIMIT: 100,
    WINDOW_SECONDS: 3600,
    KEY_PREFIX: "rate_limit:file_upload:",
  },
} as const;

// ============================================================================
// Error Types
// ============================================================================

class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly message: string;
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field?: string;
}> {}

class StorageError extends Data.TaggedError("StorageError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly message: string;
}> {}

class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly message: string;
  readonly retryAfter?: number;
}> {}

type UploadError =
  | AuthenticationError
  | ValidationError
  | StorageError
  | DatabaseError
  | TimeoutError
  | RateLimitError;

// ============================================================================
// R2 Client (lazy initialization)
// ============================================================================

let _r2Client: S3Client | null = null;

const getR2Client = (): S3Client => {
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _r2Client;
};

// ============================================================================
// Retry Schedules
// ============================================================================

const storageRetrySchedule = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(2))
);

const databaseRetrySchedule = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(3))
);

// ============================================================================
// Logging
// ============================================================================

interface LogContext {
  requestId: string;
  userId?: string;
  fileName?: string;
}

const logger = {
  info: (message: string, context: LogContext, data?: unknown) => {
    console.log(JSON.stringify({ level: "INFO", message, ...context, data }));
  },
  error: (message: string, context: LogContext, error?: unknown) => {
    const errorData = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    console.error(JSON.stringify({ level: "ERROR", message, ...context, error: errorData }));
  },
  debug: (message: string, _context: LogContext, data?: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      if (data) {
        console.debug(`[DEBUG] ${message}`, data);
      } else {
        console.debug(`[DEBUG] ${message}`);
      }
    }
  },
};

// ============================================================================
// Request ID Generation
// ============================================================================

const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `upl_${timestamp}_${random}`;
};

// ============================================================================
// Service Functions
// ============================================================================

interface AuthContext {
  userId: string;
  accessToken: string;
}

const getAuthContext = (): Effect.Effect<AuthContext, AuthenticationError> =>
  Effect.tryPromise({
    try: () => withAuth(),
    catch: () => new AuthenticationError({ message: "No se pudo verificar tu identidad. Por favor inicia sesión e intenta de nuevo." }),
  }).pipe(
    Effect.flatMap((auth) => {
      if (!auth.accessToken || !auth.user?.id) {
        return Effect.fail(new AuthenticationError({ message: "No estás autorizado para realizar esta acción. Por favor inicia sesión e intenta de nuevo." }));
      }
      return Effect.succeed({
        userId: auth.user.id,
        accessToken: auth.accessToken,
      });
    })
  );

const parseFormData = (
  req: NextRequest
): Effect.Effect<File, ValidationError> =>
  Effect.tryPromise({
    try: () => req.formData(),
    catch: () => new ValidationError({ message: "No se pudo procesar la solicitud. Por favor intenta de nuevo. Si el problema persiste, contacta con soporte.", field: "formData" }),
  }).pipe(
    Effect.flatMap((formData) => {
      const file = formData.get("file") as File | null;
      if (!file) {
        return Effect.fail(new ValidationError({ message: "No se encontró ningún archivo en la solicitud. Por favor selecciona un archivo e intenta de nuevo.", field: "file" }));
      }
      return Effect.succeed(file);
    })
  );

const validateFile = (file: File): Effect.Effect<File, ValidationError> =>
  Effect.gen(function* () {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      return yield* Effect.fail(
        new ValidationError({
          message: `No se pudo subir el archivo. El archivo es demasiado grande (máximo ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB). Por favor selecciona un archivo más pequeño e intenta de nuevo.`,
          field: "file",
        })
      );
    }

    if (!CONFIG.ALLOWED_TYPES.includes(file.type as typeof CONFIG.ALLOWED_TYPES[number])) {
      return yield* Effect.fail(
        new ValidationError({
          message: "No se pudo subir el archivo. El tipo de archivo no está soportado. Solo se permiten imágenes (JPEG, PNG, GIF, WebP) y PDFs. Por favor selecciona un archivo compatible e intenta de nuevo.",
          field: "file",
        })
      );
    }

    return file;
  });

const generateFileKey = (userId: string, fileName: string): string => {
  const fileExtension = fileName.split(".").pop() || "bin";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `uploads/${userId}/${timestamp}-${random}.${fileExtension}`;
};

const uploadToR2 = (
  file: File,
  fileKey: string,
  logContext: LogContext
): Effect.Effect<string, StorageError> =>
  Effect.gen(function* () {
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => file.arrayBuffer(),
      catch: (error) =>
        new StorageError({ message: "Failed to read file data", cause: error }),
    });

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileKey,
      Body: Buffer.from(arrayBuffer),
      ContentType: file.type,
      ContentDisposition: `inline; filename="${file.name}"`,
    });

    yield* Effect.tryPromise({
      try: () => getR2Client().send(uploadCommand),
      catch: (error) =>
        new StorageError({ message: "No se pudo guardar el archivo. Por favor intenta de nuevo. Si el problema persiste, contacta con soporte.", cause: error }),
    }).pipe(
      Effect.retry(storageRetrySchedule),
      Effect.tapError((error) =>
        Effect.sync(() => logger.error("DB upload failed", logContext, error))
      )
    );

    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${fileKey}`;
    return publicUrl;
  });

const createAttachmentRecord = (
  accessToken: string,
  publicUrl: string,
  file: File,
  logContext: LogContext
): Effect.Effect<string, DatabaseError> =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(
        api.threads.createAttachment,
        {
          dataUrl: publicUrl,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size.toString(),
        },
        { token: accessToken }
      ),
    catch: (error) =>
      new DatabaseError({ message: "No se pudo registrar el archivo en nuestra base de datos. El archivo se subió correctamente, pero no se pudo completar el proceso. Por favor intenta de nuevo. Si el problema persiste, contacta con soporte.", cause: error }),
  }).pipe(
    Effect.retry(databaseRetrySchedule),
    Effect.tapError((error) =>
      Effect.sync(() => logger.error("Database operation failed", logContext, error))
    )
  );

const logAuditEvent = (
  attachmentId: string,
  file: File
): Effect.Effect<void, never> =>
  Effect.tryPromise({
    try: () => logAttachmentUploaded(attachmentId, file.name, file.type, file.size),
    catch: () => undefined, // Audit logging failures are non-critical
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silently ignore audit failures
  );

// ============================================================================
// Response Helpers
// ============================================================================

interface UploadResponse {
  success: boolean;
  attachmentId?: string;
  url?: string;
  error?: string;
  requestId?: string;
}

const successResponse = (
  attachmentId: string,
  url: string,
  requestId: string
): NextResponse<UploadResponse> =>
  NextResponse.json(
    { success: true, attachmentId, url, requestId },
    {
      status: 200,
      headers: { "X-Request-ID": requestId },
    }
  );

const errorToResponse = (
  error: UploadError,
  requestId: string
): NextResponse<UploadResponse> => {
  const headers = { "X-Request-ID": requestId };

  switch (error._tag) {
    case "AuthenticationError":
      return NextResponse.json(
        { success: false, error: error.message, requestId },
        { status: 401, headers }
      );

    case "ValidationError":
      return NextResponse.json(
        { success: false, error: error.message, requestId },
        { status: 400, headers }
      );

    case "RateLimitError":
      return NextResponse.json(
        { success: false, error: error.message, requestId },
        { status: 429, headers }
      );

    case "TimeoutError":
      return NextResponse.json(
        { success: false, error: error.message, requestId },
        { status: 504, headers }
      );

    case "StorageError":
    case "DatabaseError":
    default:
      return NextResponse.json(
        { success: false, error: "No se pudo subir el archivo debido a un problema técnico. Por favor intenta de nuevo. Si el problema persiste, contacta con soporte.", requestId },
        { status: 500, headers }
      );
  }
};

// ============================================================================
// Main Handler
// ============================================================================

const handleUpload = (req: NextRequest, requestId: string) =>
  Effect.gen(function* () {
    const logContext: LogContext = { requestId };

    // Authenticate
    const auth = yield* getAuthContext();
    logContext.userId = auth.userId;

    logger.debug("Authentication complete", logContext);

    // Check rate limit for file uploads
    const rateLimitResult = yield* checkRateLimit(auth.userId, {
      limit: CONFIG.RATE_LIMIT.LIMIT,
      windowSeconds: CONFIG.RATE_LIMIT.WINDOW_SECONDS,
      keyPrefix: CONFIG.RATE_LIMIT.KEY_PREFIX,
    });

    if (!rateLimitResult.allowed) {
      const errorMessage = getRateLimitErrorMessage(rateLimitResult, {
        rateLimitExceeded: "No se pudo subir el archivo. Has alcanzado el límite de archivos subidos permitidos. Por favor espera [retryafter] antes de intentar de nuevo.",
        kvError: "No se pudo subir el archivo debido a un problema técnico en nuestro sistema. Por favor intenta de nuevo en unos minutos. Si el problema persiste, contacta con soporte.",
        kvNotConfigured: "No se pudo subir el archivo. El servicio está temporalmente no disponible. Por favor intenta de nuevo más tarde o contacta con soporte si el problema persiste.",
      });

      return yield* Effect.fail(
        new RateLimitError({
          message: errorMessage!,
          retryAfter: rateLimitResult.retryAfter,
        })
      );
    }

    // Parse and validate file
    const file = yield* parseFormData(req);
    logContext.fileName = file.name;

    logger.debug("File received", logContext, {
      size: file.size,
      type: file.type,
    });

    yield* validateFile(file);

    // Generate unique file key
    const fileKey = generateFileKey(auth.userId, file.name);

    // Upload to R2
    const publicUrl = yield* uploadToR2(file, fileKey, logContext);

    logger.debug("R2 upload complete", logContext, { url: publicUrl });

    // Create database record
    const attachmentId = yield* createAttachmentRecord(
      auth.accessToken,
      publicUrl,
      file,
      logContext
    );

    logger.debug("Attachment record created", logContext, { attachmentId });

    // Audit logging
    Effect.runPromise(logAuditEvent(String(attachmentId), file)).catch(() => {});

    logger.info("Upload complete", logContext, {
      attachmentId,
      fileSize: file.size,
      mimeType: file.type,
    });

    return successResponse(String(attachmentId), publicUrl, requestId);
  });

// ============================================================================
// Export POST Handler
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse<UploadResponse>> {
  const requestId = generateRequestId();
  const logContext: LogContext = { requestId };

  const program = handleUpload(req, requestId).pipe(
    // Add timeout
    Effect.timeout(Duration.millis(CONFIG.TIMEOUT_MS)),
    Effect.catchTag("TimeoutException", () =>
      Effect.fail(
        new TimeoutError({
          message: "No se pudo subir el archivo. La operación tardó demasiado tiempo. Por favor intenta con un archivo más pequeño o verifica tu conexión a internet.",
        })
      )
    ),
    // Handle all typed errors
    Effect.catchTags({
      AuthenticationError: (e: AuthenticationError) =>
        Effect.succeed(errorToResponse(e, requestId)),
      ValidationError: (e: ValidationError) =>
        Effect.succeed(errorToResponse(e, requestId)),
      RateLimitError: (e: RateLimitError) =>
        Effect.succeed(errorToResponse(e, requestId)),
      StorageError: (e: StorageError) => {
        logger.error("Storage error", logContext, e);
        return Effect.succeed(errorToResponse(e, requestId));
      },
      DatabaseError: (e: DatabaseError) => {
        logger.error("Database error", logContext, e);
        return Effect.succeed(errorToResponse(e, requestId));
      },
      TimeoutError: (e: TimeoutError) =>
        Effect.succeed(errorToResponse(e, requestId)),
    }),
    // Catch any unexpected errors
    Effect.catchAll((error: unknown) => {
      logger.error("Unhandled upload error", logContext, error);
      return Effect.succeed(
        NextResponse.json(
          { success: false, error: "Upload failed", requestId },
          { status: 500, headers: { "X-Request-ID": requestId } }
        )
      );
    })
  );

  return Effect.runPromise(program);
}
