"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { Button } from "@rift/ui/button";
import { MfaEnableModal } from "./MfaEnableModal";
import { MfaDisableModal } from "./MfaDisableModal";
import { getCurrentUserSecurityState } from "@/actions/settings/security/getCurrentUserSecurityState";
import type { SecurityAuthFactor } from "@/actions/settings/security/getCurrentUserSecurityState";

export function MfaSettings() {
  const [isPending, startTransition] = useTransition();
  const [factors, setFactors] = useState<SecurityAuthFactor[]>([]);
  const [isMfaDialogOpen, setIsMfaDialogOpen] = useState(false);
  const [isDeleteMfaPreDialogOpen, setIsDeleteMfaPreDialogOpen] = useState(false);
  const [isDeleteMfaDialogOpen, setIsDeleteMfaDialogOpen] = useState(false);

  useEffect(() => {
    getCurrentUserSecurityState().then((result) => {
      if (result.success) {
        setFactors(result.factors);
      }
    });
  }, []);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await getCurrentUserSecurityState();
      if (result.success) {
        setFactors(result.factors);
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

  if (mfaEnabled) {
    return (
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
    );
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsMfaDialogOpen(true)}
        variant="accent"
        disabled={isPending}
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
  );
}
