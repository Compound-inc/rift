"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import QRCode from "qrcode";
import { Button } from "@rift/ui/button";
import { SettingRow, SettingsInput } from "@/components/settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@rift/ui/dialog";
import { Skeleton } from "@rift/ui/skeleton";
import { startTotpEnrollment } from "@/actions/settings/security/startTotpEnrollment";
import { verifyTotpEnrollment } from "@/actions/settings/security/verifyTotpEnrollment";

type TotpEnrollmentState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
      code: string;
    }
  | {
      status: "enrolling";
      factorId: string;
      challengeId: string;
      secret: string;
      uri: string;
      code: string;
    }
  | {
      status: "success";
    };

interface MfaEnableModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  isPending: boolean;
}

export function MfaEnableModal({ isOpen, onOpenChange, onSuccess, isPending: parentIsPending }: MfaEnableModalProps) {
  const [isPending, startTransition] = useTransition();
  const [totp, setTotp] = useState<TotpEnrollmentState>({ status: "idle" });
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  // Generate QR code with theme-aware colors
  useEffect(() => {
    if (totp.status === "enrolling") {
      const titleColor = resolvedTheme === "dark" ? "#eeeeee" : "#252525";
      
      QRCode.toDataURL(totp.uri, {
        width: 180,
        margin: 2,
        color: {
          dark: titleColor,
          light: "#00000000",
        },
      })
        .then((url) => {
          setQrCodeDataUrl(url);
        })
        .catch((err) => {
          console.error("Error generating QR code:", err);
          setQrCodeDataUrl(null);
        });
    } else {
      setQrCodeDataUrl(null);
    }
  }, [totp, resolvedTheme]);

  // Automatically start TOTP enrollment when dialog opens
  useEffect(() => {
    if (isOpen && totp.status === "idle") {
      onStartTotp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const onStartTotp = () => {
    setTotp({ status: "loading", code: "" });
    setMfaError(null);
    startTransition(async () => {
      const result = await startTotpEnrollment();
      if (!result.success) {
        setMfaError(result.error ?? "No se pudo iniciar la configuración.");
        setTotp({ status: "idle" });
        return;
      }

      setTotp({
        status: "enrolling",
        factorId: result.factorId,
        challengeId: result.challengeId,
        secret: result.secret,
        uri: result.uri,
        code: "",
      });
    });
  };

  const onVerifyTotp = () =>
    startTransition(async () => {
      if (totp.status !== "enrolling") return;

      const result = await verifyTotpEnrollment({
        challengeId: totp.challengeId,
        code: totp.code,
      });

      if (!result.success) {
        setMfaError(result.error);
        return;
      }

      setMfaError(null);
      setTotp({ status: "success" });
    });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTotp({ status: "idle" });
      setMfaError(null);
    }
    onOpenChange(open);
  };

  const isLoading = isPending || parentIsPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="w-full sm:max-w-lg rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl !data-[state=closed]:animate-none !data-[state=closed]:fade-out-0 !data-[state=closed]:zoom-out-100 !duration-0"
        style={{ boxSizing: 'content-box' }}
        showCloseButton={false}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
      >
          <div className="space-y-6 p-3">
            {totp.status === "success" ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg
                    className="w-8 h-8 text-green-600 dark:text-green-400"
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
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground dark:text-popover-text">
                    MFA activado correctamente
                  </p>
                </div>
                <div className="pt-4">
                  <Button
                    type="button"
                    variant="accent"
                    onClick={() => {
                      setTotp({ status: "idle" });
                      handleOpenChange(false);
                      onSuccess();
                    }}
                    className="cursor-pointer rounded-lg font-medium gap-2 min-w-[150px]"
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                    Configurar autenticación de dos factores
                  </DialogTitle>
                  <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                    Escanea el código QR con tu app de autenticación y luego ingresa el código de 6 dígitos para verificar.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0 flex flex-col gap-3">
                    <div className="rounded-lg border border-border/60 bg-white dark:bg-popover-secondary p-3 w-fit">
                      {totp.status === "loading" || (totp.status === "enrolling" && !qrCodeDataUrl) ? (
                        <Skeleton className="w-[180px] h-[180px] rounded" />
                      ) : totp.status === "enrolling" && qrCodeDataUrl ? (
                        <div className="w-[180px] h-[180px] flex items-center justify-center">
                          <Image
                            src={qrCodeDataUrl}
                            alt="TOTP QR code"
                            width={180}
                            height={180}
                            className="w-[180px] h-[180px] object-contain"
                            unoptimized
                          />
                        </div>
                      ) : null}
                    </div>
                    {mfaError && (
                      <div className="flex items-center gap-2 text-sm text-destructive max-w-[180px]">
                        <svg
                          className="size-4 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <span>{mfaError}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-4">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">
                        Si tu app no puede escanear el QR, usa este código secreto:
                      </div>
                      {totp.status === "loading" ? (
                        <div className="rounded-lg border border-border/60 bg-white dark:bg-popover-secondary p-3 w-full">
                          <Skeleton className="h-5 w-full" />
                        </div>
                      ) : totp.status === "enrolling" ? (
                        <code className="block text-xs break-all rounded-lg border border-border/60 bg-white dark:bg-popover-secondary p-3 w-full overflow-hidden" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                          {totp.secret}
                        </code>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Código de 6 dígitos
                      </label>
                      <SettingsInput
                        type="text"
                        value={totp.status === "enrolling" ? totp.code : ""}
                        onChange={(e) => {
                          setMfaError(null);
                          setTotp((prev) =>
                            prev.status === "enrolling"
                              ? {
                                  ...prev,
                                  code: e.target.value.replace(/\D/g, "").slice(0, 6),
                                }
                              : prev,
                          );
                        }}
                        placeholder="123456"
                        className="max-w-xs !bg-white dark:!bg-popover-secondary hover:!bg-white dark:hover:!bg-popover-secondary"
                        width="w-[200px]"
                        error={!!mfaError}
                        disabled={totp.status !== "enrolling"}
                      />
                    </div>

                    <div className="pt-4 border-t border-border/30 space-y-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setTotp({ status: "idle" });
                            handleOpenChange(false);
                            setMfaError(null);
                          }}
                          disabled={isLoading}
                          className="cursor-pointer rounded-lg font-medium"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          onClick={onVerifyTotp}
                          disabled={isLoading || totp.status === "loading" || (totp.status === "enrolling" && totp.code.length !== 6)}
                          className="cursor-pointer rounded-lg font-medium gap-2 min-w-[150px]"
                          variant="accent"
                        >
                          {isLoading ? "Verificando..." : "Verificar y activar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
      </DialogContent>
    </Dialog>
  );
}
