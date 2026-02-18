"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { Button } from "@rift/ui/button";
import { PasswordChangeModal } from "./PasswordChangeModal";
import { MfaEnableModal } from "./MfaEnableModal";
import { MfaDisableModal } from "./MfaDisableModal";
import { getCurrentUserSecurityState } from "@/actions/settings/security/getCurrentUserSecurityState";
import type { SecurityAuthFactor } from "@/actions/settings/security/getCurrentUserSecurityState";

export function SecuritySettingsCard() {
  const [isPending, startTransition] = useTransition();
  const [factors, setFactors] = useState<SecurityAuthFactor[]>([]);
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [isMfaDialogOpen, setIsMfaDialogOpen] = useState(false);
  const [isDeleteMfaPreDialogOpen, setIsDeleteMfaPreDialogOpen] = useState(false);
  const [isDeleteMfaDialogOpen, setIsDeleteMfaDialogOpen] = useState(false);

  useEffect(() => {
    getCurrentUserSecurityState().then((result) => {
      if (result.success) {
        setFactors(result.factors);
        setHasPassword(result.sessions.some((s) => s.authMethod === "password"));
      }
    });
  }, []);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await getCurrentUserSecurityState();
      if (result.success) {
        setFactors(result.factors);
        setHasPassword(result.sessions.some((s) => s.authMethod === "password"));
      }
    });
  }, []);

  const handleMfaSuccess = useCallback(() => {
    setIsMfaDialogOpen(false);
    setIsDeleteMfaPreDialogOpen(false);
    setIsDeleteMfaDialogOpen(false);
    refresh();
  }, [refresh]);

  const mfaEnabled = factors.length > 0;

  return (
    <div className="p-6 bg-white dark:bg-popover-secondary rounded-lg border border-gray-200 dark:border-border shadow-sm">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center">
                <p className="font-medium text-base leading-6 text-gray-900 dark:text-white">
                  Contraseña
                </p>
              </div>
              <p className="text-gray-500 dark:text-text-muted text-sm leading-5 mt-1">
                Cambia tu contraseña para mantener tu cuenta segura
              </p>
            </div>

            <PasswordChangeModal hasPassword={hasPassword} isPending={isPending} />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-border">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-base font-medium text-foreground">
                  Autenticación de dos factores
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Protege tu cuenta con una app de autenticación
                </div>
              </div>

              {mfaEnabled ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDeleteMfaPreDialogOpen(true)}
                    disabled={isPending}
                    className="cursor-pointer"
                  >
                    Desactivar
                  </Button>

                  <MfaDisableModal
                    isPreModalOpen={isDeleteMfaPreDialogOpen}
                    onPreModalOpenChange={setIsDeleteMfaPreDialogOpen}
                    isModalOpen={isDeleteMfaDialogOpen}
                    onModalOpenChange={(open) => {
                      setIsDeleteMfaDialogOpen(open);
                      if (!open) {
                        setIsMfaDialogOpen(false);
                      }
                    }}
                    factorId={factors[0]?.id ?? ""}
                    onSuccess={handleMfaSuccess}
                    isPending={isPending}
                  />
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={() => setIsMfaDialogOpen(true)}
                    variant="accent"
                    className="gap-2 border border-border/60 shadow-sm shadow-black/5 dark:shadow-black/30 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Activar MFA
                  </Button>

                  <MfaEnableModal
                    isOpen={isMfaDialogOpen}
                    onOpenChange={setIsMfaDialogOpen}
                    onSuccess={refresh}
                    isPending={isPending}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
