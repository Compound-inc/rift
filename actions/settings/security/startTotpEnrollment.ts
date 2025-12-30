"use server";

import { Effect } from "effect";

import { checkRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit";
import {
  runSecurityAction,
  getAuthenticatedUserEffect,
  callWorkosApiEffect,
  RateLimitError,
  workos,
} from "./security-effect";

export type StartTotpEnrollmentResult =
  | {
      success: true;
      factorId: string;
      challengeId: string;
      qrCodeDataUrl: string;
      secret: string;
      uri: string;
    }
  | { success: false; error: string };

export async function startTotpEnrollment(): Promise<StartTotpEnrollmentResult> {
  return runSecurityAction({
    actionName: "startTotpEnrollment",
    fallbackMessage: "No se pudo iniciar la configuración de MFA. Intenta de nuevo.",
    hideWorkosDetails: true,
    program: Effect.gen(function* () {
      const { user } = yield* getAuthenticatedUserEffect();

      // Rate limit MFA enrollment attempts (shared pool with email verification)
      const rateLimitResult = yield* checkRateLimit(user.id, {
        limit: 6, // 6 attempts per window (shared with email verification)
        windowSeconds: 600, // 10 minute window
        keyPrefix: "rate_limit:security_verification:",
      });

      if (!rateLimitResult.allowed) {
        const errorMessage = getRateLimitErrorMessage(rateLimitResult, {
          rateLimitExceeded: "Has realizado demasiados intentos de configuración de seguridad. Por favor espera [retryafter] antes de intentar de nuevo.",
        });

        return yield* Effect.fail(
          new RateLimitError({
            message: errorMessage!,
            retryAfter: rateLimitResult.retryAfter,
          })
        );
      }

      const { authenticationFactor, authenticationChallenge } = yield* callWorkosApiEffect(
        "userManagement.enrollAuthFactor",
        () =>
          workos.userManagement.enrollAuthFactor({
            userId: user.id,
            type: "totp",
            totpIssuer: "Rift",
            totpUser: user.email,
          }),
      );

      const qrCode = authenticationFactor.totp.qrCode;
      const qrCodeDataUrl = qrCode.startsWith("data:")
        ? qrCode
        : `data:image/png;base64,${qrCode}`;

      return {
        success: true as const,
        factorId: authenticationFactor.id,
        challengeId: authenticationChallenge.id,
        qrCodeDataUrl,
        secret: authenticationFactor.totp.secret,
        uri: authenticationFactor.totp.uri,
      };
    }),
  });
}

