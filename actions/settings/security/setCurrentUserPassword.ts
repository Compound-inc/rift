"use server";

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

type SetCurrentUserPasswordArgs = {
  newPassword: string;
};

export async function setCurrentUserPassword(
  args: SetCurrentUserPasswordArgs,
): Promise<{ success: true } | { success: false; error: string }> {
  const newPassword = args.newPassword ?? "";
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error || "Contraseña inválida.",
    };
  }

  return runSecurityAction({
    actionName: "setCurrentUserPassword",
    fallbackMessage: "No se pudo establecer la contraseña. Intenta de nuevo.",
    hideWorkosDetails: true,
    program: Effect.gen(function* () {
      const { user } = yield* getAuthenticatedUserEffect();
      yield* requireEmailVerificationStepUpEffect(user.id);

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

