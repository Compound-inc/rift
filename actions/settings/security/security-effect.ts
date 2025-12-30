import "server-only";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { Data, Effect } from "effect";

import { workos } from "@/app/api/workos";
import { assertStepUpVerified } from "@/lib/securityStepUp";

// ============================================================================
// Result Types
// ============================================================================

export type SecurityErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "STEP_UP_REQUIRED"
  | "NOT_FOUND"
  | "CONFIG_ERROR"
  | "WORKOS_ERROR"
  | "RATE_LIMIT_ERROR"
  | "INTERNAL_ERROR";

export type SecurityActionFailure = {
  success: false;
  error: string;
  errorCode?: SecurityErrorCode;
  requestId?: string;
};
export type SecurityActionSuccess<T extends object = object> = { success: true } & T;
export type SecurityActionResult<T extends object = object> =
  | SecurityActionSuccess<T>
  | SecurityActionFailure;

// ============================================================================
// Error Types (Effect Tagged Errors)
// ============================================================================

export class SecurityAuthError extends Data.TaggedError("SecurityAuthError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SecurityStepUpRequiredError extends Data.TaggedError(
  "SecurityStepUpRequiredError",
)<{
  readonly message: string;
}> {}

export class SecurityValidationError extends Data.TaggedError(
  "SecurityValidationError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SecurityNotFoundError extends Data.TaggedError("SecurityNotFoundError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SecurityConfigError extends Data.TaggedError("SecurityConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class WorkosApiError extends Data.TaggedError("WorkosApiError")<{
  readonly operation: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;
}> {}

export class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly message: string;
  readonly retryAfter?: number;
}> {}

export type SecurityActionError =
  | SecurityAuthError
  | SecurityStepUpRequiredError
  | SecurityValidationError
  | SecurityNotFoundError
  | SecurityConfigError
  | WorkosApiError
  | RateLimitError;

// ============================================================================
// Helpers
// ============================================================================

type LogContext = {
  readonly actionName: string;
  readonly requestId: string;
};

const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sec_${timestamp}_${random}`;
};

const toErrorMessage = (cause: unknown): string => {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string") return cause;
  try {
    return JSON.stringify(cause);
  } catch {
    return "Unknown error";
  }
};

const getStatus = (cause: unknown): number | undefined => {
  if (typeof cause !== "object" || cause === null) return undefined;
  const maybe = cause as any;
  const status = maybe.status ?? maybe.statusCode;
  return typeof status === "number" ? status : undefined;
};

const getRequestId = (cause: unknown): string | undefined => {
  if (typeof cause !== "object" || cause === null) return undefined;
  const maybe = cause as any;
  const rid =
    maybe.requestId ??
    maybe.request_id ??
    maybe.headers?.["x-request-id"] ??
    maybe.response?.headers?.get?.("x-request-id");
  return typeof rid === "string" ? rid : undefined;
};

const getCode = (cause: unknown): string | undefined => {
  if (typeof cause !== "object" || cause === null) return undefined;
  const maybe = cause as any;
  const code = maybe.code ?? maybe.errorCode ?? maybe.error_code;
  return typeof code === "string" ? code : undefined;
};

// ============================================================================
// Public Error Mapping
// ============================================================================

const toPublicMessage = (
  error: SecurityActionError,
  opts: { fallbackMessage?: string; hideDetails?: boolean } = {},
): string => {
  switch (error._tag) {
    case "SecurityAuthError":
      return "Necesitas iniciar sesión para continuar.";
    case "SecurityStepUpRequiredError":
      return "Necesitas verificar tu identidad por correo para continuar.";
    case "SecurityValidationError":
    case "SecurityNotFoundError":
    case "SecurityConfigError":
      return error.message;
    case "RateLimitError":
      return error.message;
    case "WorkosApiError": {
      const status = error.status;
      
      const isPasswordStrengthError = status === 400 && error.code === "password_strength_error";
      
      if (opts.hideDetails && !isPasswordStrengthError) {
        return opts.fallbackMessage ?? "Ocurrió un error. Intenta de nuevo.";
      }

      // Common HTTP status mappings.
      if (status === 401 || status === 403) {
        return "No autorizado.";
      }
      if (status === 404) {
        return "No encontrado.";
      }
      if (status === 429) {
        return "Demasiadas solicitudes. Intenta de nuevo en unos segundos.";
      }
      if (typeof status === "number" && status >= 500) {
        return "Servicio temporalmente no disponible. Intenta de nuevo.";
      }

      // For password validation errors, show the actual error message
      // For other errors, show message if not hiding details
      return error.message || opts.fallbackMessage || "Ocurrió un error. Intenta de nuevo.";
    }
  }
};

const errorCodeOf = (error: SecurityActionError): SecurityErrorCode => {
  switch (error._tag) {
    case "SecurityValidationError":
      return "VALIDATION_ERROR";
    case "SecurityAuthError":
      return "AUTH_ERROR";
    case "SecurityStepUpRequiredError":
      return "STEP_UP_REQUIRED";
    case "SecurityNotFoundError":
      return "NOT_FOUND";
    case "SecurityConfigError":
      return "CONFIG_ERROR";
    case "WorkosApiError":
      return "WORKOS_ERROR";
    case "RateLimitError":
      return "RATE_LIMIT_ERROR";
  }
};

// ============================================================================
// Logging (structured + redacted)
// ============================================================================

const logSecurityError = (ctx: LogContext, error: unknown) => {
  // Intentionally avoid logging arguments (passwords, TOTP codes, etc).
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tagged = error as any;
    if (tagged._tag === "WorkosApiError") {
      const safe = {
        _tag: tagged._tag,
        operation: tagged.operation,
        status: tagged.status,
        code: tagged.code,
        requestId: tagged.requestId,
        message: tagged.message,
      };
      console.error(`[security] ${ctx.actionName} failed`, { ...safe, requestId: ctx.requestId });
      return;
    }
  }

  console.error(`[security] ${ctx.actionName} failed`, { requestId: ctx.requestId, error });
};

// ============================================================================
// Effect Helpers (Auth / Step-up / WorkOS)
// ============================================================================

/**
 * Gets the currently authenticated user and their session ID.
 * Fails if the user is not signed in.
 */
export const getAuthenticatedUserEffect = (): Effect.Effect<
  { user: { id: string; email: string }; sessionId: string },
  SecurityAuthError,
  never
> =>
  Effect.tryPromise({
    try: async () => {
      const { user, sessionId } = await withAuth({ ensureSignedIn: true });
      return { user: { id: user.id, email: user.email }, sessionId };
    },
    catch: (cause) =>
      new SecurityAuthError({
        message: "Not authenticated",
        cause,
      }),
  });

/**
 * Requires that the user has completed email verification step-up.
 * This is used for sensitive operations like password changes or MFA deletion.
 */
export const requireEmailVerificationStepUpEffect = (
  userId: string,
): Effect.Effect<void, SecurityStepUpRequiredError, never> =>
  Effect.tryPromise({
    try: async () => {
      const res = await assertStepUpVerified(userId);
      if (!res.ok) {
        throw new Error("step_up_required");
      }
    },
    catch: () =>
      new SecurityStepUpRequiredError({
        message: "step_up_required",
      }),
  });

/**
 * Wraps a WorkOS API call in an Effect, capturing errors with structured metadata.
 * @param operation - Human-readable name of the operation (e.g., "userManagement.listAuthFactors")
 * @param thunk - The WorkOS API call to execute
 */
export const callWorkosApiEffect = <A>(
  operation: string,
  thunk: () => Promise<A>,
): Effect.Effect<A, WorkosApiError, never> =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) =>
      new WorkosApiError({
        operation,
        message: toErrorMessage(cause),
        cause,
        status: getStatus(cause),
        code: getCode(cause),
        requestId: getRequestId(cause),
      }),
  });

// ============================================================================
// Runner
// ============================================================================

export const runSecurityAction = async <
  T extends SecurityActionResult<any>,
>(args: {
  actionName: string;
  program: Effect.Effect<T, SecurityActionError, never>;
  fallbackMessage?: string;
  hideWorkosDetails?: boolean;
}): Promise<T> => {
  const ctx: LogContext = { actionName: args.actionName, requestId: generateRequestId() };

  const effect = args.program.pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        logSecurityError(ctx, error);
        return {
          success: false as const,
          error: toPublicMessage(error, {
            fallbackMessage: args.fallbackMessage,
            hideDetails: args.hideWorkosDetails ?? false,
          }),
          errorCode: errorCodeOf(error),
          requestId: ctx.requestId,
        } as T;
      }),
    ),
    Effect.catchAllDefect((defect) =>
      Effect.sync(() => {
        logSecurityError(ctx, defect);
        return {
          success: false as const,
          error: args.fallbackMessage ?? "Ocurrió un error. Intenta de nuevo.",
          errorCode: "INTERNAL_ERROR" as const,
          requestId: ctx.requestId,
        } as T;
      }),
    ),
  );

  return Effect.runPromise(effect);
};

export { workos };
