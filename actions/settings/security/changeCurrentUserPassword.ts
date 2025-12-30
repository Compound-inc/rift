"use server";

import { headers } from "next/headers";
import { Effect } from "effect";

import { clearStepUpCookie } from "@/lib/securityStepUp";

import {
  getAuthenticatedUserEffect,
  requireEmailVerificationStepUpEffect,
  runSecurityAction,
  SecurityConfigError,
  workos,
  callWorkosApiEffect,
} from "./security-effect";

import { validatePassword } from "@/lib/password-validation";

type ChangeCurrentUserPasswordArgs = {
  currentPassword: string;
  newPassword: string;
};

async function bestEffortClientIp(): Promise<string | undefined> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return h.get("x-real-ip") ?? undefined;
}

export async function changeCurrentUserPassword(
  args: ChangeCurrentUserPasswordArgs,
): Promise<{ success: true } | { success: false; error: string }> {
  const currentPassword = args.currentPassword ?? "";
  const newPassword = args.newPassword ?? "";

  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error || "Contraseña inválida.",
    };
  }

  return runSecurityAction({
    actionName: "changeCurrentUserPassword",
    fallbackMessage:
      "No se pudo cambiar la contraseña. Verifica tu contraseña actual e inténtalo de nuevo.",
    hideWorkosDetails: true,
    program: Effect.gen(function* () {
      const { user } = yield* getAuthenticatedUserEffect();
      yield* requireEmailVerificationStepUpEffect(user.id);

      const clientId = process.env.WORKOS_CLIENT_ID;
      if (!clientId) {
        return yield* Effect.fail(
          new SecurityConfigError({
            message: "Servicio no disponible. Intenta más tarde.",
            cause: "WORKOS_CLIENT_ID missing",
          }),
        );
      }

      // Re-authenticate with current password before allowing password change.
      // This reduces risk from a stolen session cookie.
      const h = yield* Effect.tryPromise({
        try: () => headers(),
        catch: (cause) =>
          new SecurityConfigError({
            message: "No se pudo cambiar la contraseña. Intenta de nuevo.",
            cause,
          }),
      });

      const ipAddress = yield* Effect.promise(() => bestEffortClientIp()).pipe(
        Effect.catchAll(() => Effect.succeed(undefined)),
      );

      yield* callWorkosApiEffect("userManagement.authenticateWithPassword", () =>
        workos.userManagement.authenticateWithPassword({
          clientId,
          email: user.email,
          password: currentPassword,
          ipAddress,
          userAgent: h.get("user-agent") ?? undefined,
          session: { sealSession: false },
        }),
      );

      yield* callWorkosApiEffect("userManagement.updateUser", () =>
        workos.userManagement.updateUser({
          userId: user.id,
          password: newPassword,
        }),
      );

      yield* Effect.tryPromise({
        try: () => clearStepUpCookie(),
        catch: (cause) =>
          new SecurityConfigError({
            message: "No se pudo completar la operación. Intenta de nuevo.",
            cause,
          }),
      });

      return { success: true as const };
    }),
  });
}

