"use client";

import { useState, useTransition } from "react";
import { Button } from "@rift/ui/button";
import { SettingRow, SettingsInput } from "@/components/settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@rift/ui/dialog";
import { deleteAuthFactor } from "@/actions/settings/security/deleteAuthFactor";
import { sendSecurityEmailVerification } from "@/actions/settings/security/sendSecurityEmailVerification";
import { confirmSecurityEmailVerification } from "@/actions/settings/security/confirmSecurityEmailVerification";
import { toast } from "sonner";

interface MfaDisableModalProps {
  isPreModalOpen: boolean;
  onPreModalOpenChange: (open: boolean) => void;
  isModalOpen: boolean;
  onModalOpenChange: (open: boolean) => void;
  factorId: string;
  onSuccess: () => void;
  isPending: boolean;
}

export function MfaDisableModal({
  isPreModalOpen,
  onPreModalOpenChange,
  isModalOpen,
  onModalOpenChange,
  factorId,
  onSuccess,
  isPending: parentIsPending,
}: MfaDisableModalProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteMfaStepUpCode, setDeleteMfaStepUpCode] = useState("");
  const [deleteMfaStepUpError, setDeleteMfaStepUpError] = useState<string | null>(null);
  const [deleteMfaStepUpVerified, setDeleteMfaStepUpVerified] = useState(false);

  const beginDeleteMfaStepUp = () =>
    startTransition(async () => {
      setDeleteMfaStepUpError(null);
      setDeleteMfaStepUpCode("");
      setDeleteMfaStepUpVerified(false);
      const res = await sendSecurityEmailVerification();
      if (!res.success) {
        setDeleteMfaStepUpError(
          res.error ?? "No se pudo enviar el código. Intenta de nuevo.",
        );
      }
    });

  const verifyDeleteMfaStepUp = () =>
    startTransition(async () => {
      setDeleteMfaStepUpError(null);
      const res = await confirmSecurityEmailVerification(deleteMfaStepUpCode);
      if (!res.success) {
        setDeleteMfaStepUpError(res.error);
        return;
      }
      setDeleteMfaStepUpVerified(true);
    });

  const onDeleteFactor = () =>
    startTransition(async () => {
      const result = await deleteAuthFactor(factorId);
      if (!result.success) {
        toast.error(result.error ?? "No se pudo desactivar MFA.");
        return;
      }
      toast.success("MFA desactivado correctamente");
      onModalOpenChange(false);
      onSuccess();
    });

  const openDeleteMfaFlow = () => {
    onPreModalOpenChange(false);
    onModalOpenChange(true);
    beginDeleteMfaStepUp();
  };

  const handleDialogOpenChange = (open: boolean) => {
    onModalOpenChange(open);
    if (!open) {
      setDeleteMfaStepUpCode("");
      setDeleteMfaStepUpError(null);
      setDeleteMfaStepUpVerified(false);
    }
  };

  const isLoading = isPending || parentIsPending;

  return (
    <>
      {/* Pre-step-up confirmation for disabling MFA */}
      <Dialog
        open={isPreModalOpen}
        onOpenChange={onPreModalOpenChange}
      >
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
                Para desactivar MFA, necesitamos verificar tu identidad enviando
                un código a tu correo.
              </DialogDescription>
            </DialogHeader>
            <div className="pt-4 border-t border-border/30">
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onPreModalOpenChange(false)}
                  disabled={isLoading}
                  className="cursor-pointer rounded-lg font-medium"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  onClick={openDeleteMfaFlow}
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

      <Dialog 
        open={isModalOpen} 
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent 
          className="max-w-md rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl !data-[state=closed]:animate-none !data-[state=closed]:fade-out-0 !data-[state=closed]:zoom-out-100 !duration-0"
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="space-y-6 p-2">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                Desactivar autenticación de dos factores
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                ¿Estás seguro de que deseas desactivar la autenticación de dos factores? Tu cuenta será menos segura sin esta protección adicional.
              </DialogDescription>
            </DialogHeader>

            {!deleteMfaStepUpVerified ? (
              <div className="space-y-4">
                <SettingRow label="Código de verificación">
                  <SettingsInput
                    type="text"
                    value={deleteMfaStepUpCode}
                    onChange={(e) => {
                      setDeleteMfaStepUpCode(
                        e.target.value.replace(/\D/g, "").slice(0, 6),
                      );
                      setDeleteMfaStepUpError(null);
                    }}
                    width="w-full"
                    placeholder="123456"
                    error={!!deleteMfaStepUpError}
                  />
                </SettingRow>

                {deleteMfaStepUpError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <span>{deleteMfaStepUpError}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-border/30 space-y-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDialogOpenChange(false)}
                      disabled={isLoading}
                      className="cursor-pointer rounded-lg font-medium"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="accent"
                      onClick={verifyDeleteMfaStepUp}
                      disabled={isLoading || deleteMfaStepUpCode.length !== 6}
                      className="gap-2 border border-border/60 shadow-sm shadow-black/5 dark:shadow-black/30 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium min-w-[150px]"
                    >
                      {isLoading ? "Verificando..." : "Verificar"}
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-text-muted dark:hover:text-white underline underline-offset-4"
                    onClick={beginDeleteMfaStepUp}
                    disabled={isLoading}
                  >
                    Reenviar código
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-border/30 space-y-3">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                    disabled={isLoading}
                    className="cursor-pointer rounded-lg font-medium"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onDeleteFactor}
                    disabled={isLoading}
                    className="cursor-pointer rounded-lg font-medium gap-2 min-w-[150px]"
                  >
                    {isLoading ? "Desactivando..." : "Desactivar MFA"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
