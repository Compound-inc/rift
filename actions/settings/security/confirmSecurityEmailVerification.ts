"use server";

import { Effect } from "effect";
import crypto from "crypto";

import {
  clearPendingStepUpMagicAuthCookie,
  getPendingStepUpMagicAuthId,
  setStepUpCookie,
} from "@/lib/securityStepUp";
import {
  getAuthenticatedUserEffect,
  runSecurityAction,
  SecurityConfigError,
  workos,
  callWorkosApiEffect,
} from "./security-effect";

export async function confirmSecurityEmailVerification(
  code: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmed = (code ?? "").trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { success: false, error: "Ingresa un código de 6 dígitos." };
  }

  return runSecurityAction({
    actionName: "confirmSecurityEmailVerification",
    fallbackMessage: "Código inválido o expirado. Intenta de nuevo.",
    hideWorkosDetails: true,
    program: Effect.gen(function* () {
      const { user } = yield* getAuthenticatedUserEffect();

      const magicAuthId = yield* Effect.tryPromise({
        try: () => getPendingStepUpMagicAuthId(user.id),
        catch: (cause) =>
          new SecurityConfigError({
            message: "Código inválido o expirado. Intenta de nuevo.",
            cause,
          }),
      });

      if (!magicAuthId) {
        return {
          success: false as const,
          error: "El código expiró. Solicita uno nuevo.",
        };
      }

      const magic = yield* callWorkosApiEffect("userManagement.getMagicAuth", () =>
        workos.userManagement.getMagicAuth(magicAuthId),
      );

      if (magic.userId !== user.id || magic.email !== user.email) {
        return { success: false as const, error: "Código inválido o expirado. Intenta de nuevo." };
      }

      const codeBuffer = Buffer.from(magic.code);
      const trimmedBuffer = Buffer.from(trimmed);
      if (codeBuffer.length !== trimmedBuffer.length || !crypto.timingSafeEqual(codeBuffer, trimmedBuffer)) {
        return { success: false as const, error: "Código inválido o expirado. Intenta de nuevo." };
      }

      if (Date.now() > Date.parse(magic.expiresAt)) {
        return { success: false as const, error: "Código inválido o expirado. Intenta de nuevo." };
      }

      // Short-lived step-up authorization for sensitive security actions.
      yield* Effect.tryPromise({
        try: () => setStepUpCookie(user.id),
        catch: (cause) =>
          new SecurityConfigError({
            message: "No se pudo completar la verificación. Intenta de nuevo.",
            cause,
          }),
      });

      yield* Effect.tryPromise({
        try: () => clearPendingStepUpMagicAuthCookie(),
        catch: (cause) =>
          new SecurityConfigError({
            message: "No se pudo completar la verificación. Intenta de nuevo.",
            cause,
          }),
      });

      return { success: true as const };
    }),
  });
}

