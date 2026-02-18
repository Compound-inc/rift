"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@rift/ui/button";
import { SettingRow, SettingsInput } from "@/components/settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@rift/ui/dialog";
import { Eye, EyeOff, Check, X, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { changeCurrentUserPassword } from "@/actions/settings/security/changeCurrentUserPassword";
import { setCurrentUserPassword } from "@/actions/settings/security/setCurrentUserPassword";
import { sendSecurityEmailVerification } from "@/actions/settings/security/sendSecurityEmailVerification";
import { confirmSecurityEmailVerification } from "@/actions/settings/security/confirmSecurityEmailVerification";
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/password-validation";
import { cn } from "@rift/utils";

interface PasswordChangeModalProps {
  hasPassword: boolean;
  isPending: boolean;
}

function PasswordRequirement({ label, met, show }: { label: string; met: boolean; show: boolean }) {
  if (!show) return null;
  return (
    <div className={cn(
      "flex items-center gap-2 text-xs transition-colors duration-200",
      met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
    )}>
      {met ? <Check className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border border-current opacity-50" />}
      <span>{label}</span>
    </div>
  );
}

export function PasswordChangeModal({ hasPassword, isPending: parentIsPending }: PasswordChangeModalProps) {
  const [isPending, startTransition] = useTransition();
  const [isPasswordPreDialogOpen, setIsPasswordPreDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordStepUpCode, setPasswordStepUpCode] = useState("");
  const [passwordStepUpError, setPasswordStepUpError] = useState<string | null>(null);
  const [passwordStepUpVerified, setPasswordStepUpVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);

  const validation = useMemo(() => validatePassword(newPassword), [newPassword]);
  const isPasswordValid = validation.isValid;
  const isConfirmValid = newPassword === confirmPassword && newPassword !== "";

  const onChangePassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasTriedSubmit(true);
    startTransition(async () => {
      setPasswordError(null);
      setPasswordSuccess(false);
      
      if (!isPasswordValid) {
        setPasswordError(validation.error || "La contraseña no cumple con los requisitos.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError("Las contraseñas no coinciden.");
        return;
      }

      const result = hasPassword
        ? await changeCurrentUserPassword({
            currentPassword,
            newPassword,
          })
        : await setCurrentUserPassword({
            newPassword,
          });

      if (!result.success) {
        setPasswordError(result.error);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordSuccess(true);
      setTimeout(() => {
        setPasswordSuccess(false);
        setIsPasswordDialogOpen(false);
      }, 3000);
    });
  };

  const strengthColor = useMemo(() => {
    if (newPassword === "") return "bg-gray-200 dark:bg-gray-800";
    switch (validation.score) {
      case 0: return "bg-destructive";
      case 1: return "bg-orange-500";
      case 2: return "bg-yellow-500";
      case 3: return "bg-lime-500";
      case 4: return "bg-green-500";
      default: return "bg-gray-200 dark:bg-gray-800";
    }
  }, [newPassword, validation.score]);

  const strengthText = useMemo(() => {
    if (newPassword === "") return "";
    switch (validation.score) {
      case 0: return "Muy débil";
      case 1: return "Débil";
      case 2: return "Regular";
      case 3: return "Fuerte";
      case 4: return "Muy fuerte";
      default: return "";
    }
  }, [newPassword, validation.score]);

  const beginPasswordStepUp = () =>
    startTransition(async () => {
      setPasswordStepUpError(null);
      setPasswordStepUpCode("");
      setPasswordStepUpVerified(false);
      const res = await sendSecurityEmailVerification();
      if (!res.success) {
        setPasswordStepUpError(
          res.error ?? "No se pudo enviar el código. Intenta de nuevo.",
        );
      }
    });

  const verifyPasswordStepUp = () =>
    startTransition(async () => {
      setPasswordStepUpError(null);
      const res = await confirmSecurityEmailVerification(passwordStepUpCode);
      if (!res.success) {
        setPasswordStepUpError(res.error);
        return;
      }
      setPasswordStepUpVerified(true);
    });

  const openPasswordFlow = () => {
    setIsPasswordPreDialogOpen(false);
    setIsPasswordDialogOpen(true);
    beginPasswordStepUp();
  };

  const clearPasswordDialogState = () => {
    setPasswordStepUpCode("");
    setPasswordStepUpError(null);
    setPasswordStepUpVerified(false);
    setPasswordError(null);
    setPasswordSuccess(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setHasTriedSubmit(false);
  };

  const handleClosePasswordDialog = () => {
    clearPasswordDialogState();
    setIsPasswordDialogOpen(false);
  };

  const isLoading = isPending || parentIsPending;

  return (
    <>
      {/* Pre-step-up confirmation */}
      <Dialog
        open={isPasswordPreDialogOpen}
        onOpenChange={setIsPasswordPreDialogOpen}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="accent" className="gap-2 border border-border/60 shadow-sm shadow-black/5 dark:shadow-black/30 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
            Cambiar contraseña
          </Button>
        </DialogTrigger>
        <DialogContent 
          className="max-w-md rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl !data-[state=closed]:animate-none !data-[state=closed]:fade-out-0 !data-[state=closed]:zoom-out-100 !duration-0"
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="space-y-6 p-2">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                Verificar identidad
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                Para continuar, necesitamos verificar tu identidad enviando un
                código a tu correo.
              </DialogDescription>
            </DialogHeader>

            <div className="pt-4 border-t border-border/30">
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPasswordPreDialogOpen(false)}
                  disabled={isLoading}
                  className="cursor-pointer rounded-lg font-medium"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  onClick={openPasswordFlow}
                  disabled={isLoading}
                  className="gap-2 border border-border/60 shadow-sm shadow-black/5 dark:shadow-black/30 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium min-w-[150px]"
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step-up + password dialog */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          setIsPasswordDialogOpen(open);
          if (!open) {
            clearPasswordDialogState();
          }
        }}
      >
        <DialogContent 
          className="max-w-md rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl !data-[state=closed]:animate-none !data-[state=closed]:fade-out-0 !data-[state=closed]:zoom-out-100 !duration-0" 
          style={{ boxSizing: 'content-box' }}
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {passwordSuccess ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 space-y-6 text-center">
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                <svg
                  className="size-12 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                  Contraseña actualizada
                </DialogTitle>
                <DialogDescription className="text-base text-muted-foreground max-w-md">
                  Tu contraseña ha sido actualizada correctamente.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <Button
                  onClick={handleClosePasswordDialog}
                  className="gap-2 border border-border/60 shadow-sm shadow-black/5 dark:shadow-black/30 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium min-w-[100px]"
                  variant="accent"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 p-2">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                  Cambiar contraseña
                </DialogTitle>
                {!passwordStepUpVerified ? (
                  <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                    Primero verifica tu identidad con un código enviado a tu correo.
                  </DialogDescription>
                ) : (
                  <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                    {hasPassword
                      ? "Ingresa tu contraseña actual y la nueva contraseña."
                      : "Ingresa tu nueva contraseña."}
                  </DialogDescription>
                )}
              </DialogHeader>

              {!passwordStepUpVerified ? (
                <div className="space-y-4">
                  <SettingRow label="Código de verificación">
                    <SettingsInput
                      type="text"
                      value={passwordStepUpCode}
                      onChange={(e) => {
                        setPasswordStepUpCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        );
                        setPasswordStepUpError(null);
                      }}
                      width="w-full"
                      placeholder="123456"
                      error={!!passwordStepUpError}
                    />
                  </SettingRow>

                  {passwordStepUpError && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <span>{passwordStepUpError}</span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/30 space-y-3">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClosePasswordDialog}
                        disabled={isLoading}
                        className="cursor-pointer rounded-lg font-medium mr-2"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        disabled={isLoading || passwordStepUpCode.length !== 6}
                        className="gap-2 border border-border/60 shadow-sm shadow-black/5 dark:shadow-black/30 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium min-w-[150px]"
                        variant="accent"
                        onClick={verifyPasswordStepUp}
                      >
                        {isLoading ? "Verificando..." : "Verificar"}
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-text-muted dark:hover:text-white underline underline-offset-4"
                      onClick={beginPasswordStepUp}
                      disabled={isLoading}
                    >
                      Reenviar código
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onChangePassword} className="space-y-4">
                  {hasPassword && (
                    <SettingRow label="Contraseña actual">
                      <div className="relative w-full">
                        <SettingsInput
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => {
                            setCurrentPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          autoComplete="current-password"
                          width="w-full"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-text-muted dark:hover:text-white transition-colors"
                          aria-label={showCurrentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </SettingRow>
                  )}

                  <div className="space-y-2">
                    <SettingRow label="Nueva contraseña">
                      <div className="relative w-full">
                        <SettingsInput
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          autoComplete="new-password"
                          width="w-full"
                          className="pr-10"
                          error={hasTriedSubmit && !isPasswordValid}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-text-muted dark:hover:text-white transition-colors"
                          aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </SettingRow>

                    <div className="space-y-3 px-1">
                      <div className="flex items-center justify-between gap-3 min-h-[14px]">
                        <div className="flex flex-1 h-1.5 gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-full flex-1 rounded-full transition-all duration-300",
                                newPassword !== "" && i < validation.score + 1 ? strengthColor : "bg-gray-200 dark:bg-gray-800"
                              )}
                            />
                          ))}
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase w-[85px] text-right shrink-0 h-[14px] flex items-center justify-end",
                          newPassword !== "" ? strengthColor.replace('bg-', 'text-') : "text-muted-foreground"
                        )}>
                          {strengthText || "\u00A0"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-1.5">
                        <PasswordRequirement 
                          label={`Mínimo ${PASSWORD_REQUIREMENTS.minLength} caracteres`} 
                          met={validation.requirements.length} 
                          show={true} 
                        />
                        <PasswordRequirement 
                          label="Al menos un carácter especial" 
                          met={validation.requirements.specialChar} 
                          show={true} 
                        />
                        <PasswordRequirement 
                          label="Contraseña segura" 
                          met={validation.requirements.strength} 
                          show={true} 
                        />
                      </div>
                    </div>
                  </div>

                  <SettingRow label="Confirmar nueva contraseña">
                    <div className="relative w-full">
                      <SettingsInput
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordError(null);
                        }}
                        autoComplete="new-password"
                        width="w-full"
                        className="pr-10"
                        error={hasTriedSubmit && !isConfirmValid}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-text-muted dark:hover:text-white transition-colors"
                        aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </SettingRow>

                {passwordError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 p-2.5 rounded-lg border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                    <ShieldAlert className="size-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-border/30 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClosePasswordDialog}
                      disabled={isLoading}
                      className="cursor-pointer rounded-lg font-medium mr-2"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading || !isPasswordValid || !isConfirmValid}
                      className="gap-2 border border-border/60 shadow-sm shadow-black/5 dark:shadow-black/30 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium min-w-[150px]"
                      variant="accent"
                    >
                      {isLoading ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                </div>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
