"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@rift/ui/dialog";
import { Label } from "@rift/ui/label";
import { Input } from "@rift/ui/input";
import { Button } from "@rift/ui/button";
import { Switch } from "@rift/ui/switch";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";

type ShareState = {
  shareId?: string;
  status?: "active" | "revoked";
  shareStatus?: "active" | "revoked";
  isShared: boolean;
};

type ThreadSummary = {
  threadId: string;
  title: string;
  shareId?: string;
  shareStatus?: "active" | "revoked";
};

type ShareSettingsModalProps = {
  thread: ThreadSummary | null;
  shareState: ShareState | null;
  onClose: () => void;
  handleToggleShare: (
    thread: ThreadSummary,
    isShared: boolean,
    settings?: {
      orgOnly?: boolean;
      shareName?: boolean;
    },
  ) => Promise<void>;
  handleCopyShareLink: (shareId: string) => Promise<void>;
  updateShareSettings: (args: {
    threadId: string;
    orgOnly: boolean;
    shareName: boolean;
  }) => Promise<unknown>;
  regenerateShareLink: (args: { threadId: string }) => Promise<{ shareId: string }>;
};

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

const ToggleRow = ({ label, description, checked, disabled, onChange }: ToggleRowProps) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      className="cursor-pointer data-[state=checked]:bg-accent focus-visible:ring-accent/40"
    />
  </div>
);

export function ShareSettingsModal({
  thread,
  shareState,
  onClose,
  handleToggleShare,
  handleCopyShareLink,
  updateShareSettings,
  regenerateShareLink,
}: ShareSettingsModalProps) {
  const shareStatus = useQuery(
    api.share.getShareStatus,
    thread ? { threadId: thread.threadId } : "skip",
  );

  const [isSharedLocal, setIsSharedLocal] = useState<boolean>(false);
  const [orgOnly, setOrgOnly] = useState(false);
  const [shareName, setShareName] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(false);
  const [pendingSettings, setPendingSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived values that should not change hook order; compute even if thread/ shareState are null.
  const shareId = shareStatus?.shareId ?? shareState?.shareId;
  const isShared = isSharedLocal;
  const shareUrl = useMemo(
    () =>
      shareId
        ? typeof window !== "undefined"
          ? `${window.location.origin}/share/${shareId}`
          : `/share/${shareId}`
        : "Activa el enlace para generar la URL pública",
    [shareId],
  );
  const isLoadingShareStatus = Boolean(thread) && shareStatus === undefined;
  const effectiveShareStatus =
    shareStatus?.status ?? shareState?.status ?? shareState?.shareStatus;
  const { statusLabel, statusClass } = useMemo(() => {
    if (isLoadingShareStatus) {
      return {
        statusLabel: "Cargando estado...",
        statusClass: "bg-muted text-muted-foreground border border-border",
      };
    }
    if (!isShared) {
      return {
        statusLabel: "Desactivada",
        statusClass: "bg-muted text-muted-foreground border border-border",
      };
    }
    if (effectiveShareStatus === "revoked") {
      return {
        statusLabel: "Reactivando",
        statusClass: "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
      };
    }
    return {
      statusLabel: "Activa",
      statusClass: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    };
  }, [effectiveShareStatus, isLoadingShareStatus, isShared]);

  useEffect(() => {
    if (!shareState) return;
    if (pendingToggle || pendingSettings) return;

    const nextIsShared =
      (shareStatus?.isShared ?? undefined) !== undefined
        ? Boolean(shareStatus?.isShared)
        : shareState.isShared;
    setIsSharedLocal(nextIsShared);
    setOrgOnly((prev) => shareStatus?.orgOnly ?? prev);
    setShareName((prev) => shareStatus?.shareName ?? prev);
  }, [shareState, shareStatus, pendingToggle, pendingSettings]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  if (!thread || !shareState) return null;

  const persistSettings = async (nextOrgOnly: boolean, nextShareName: boolean) => {
    if (!isShared) return;
    const prevOrgOnly = orgOnly;
    const prevShareName = shareName;
    setPendingSettings(true);
    setOrgOnly(nextOrgOnly);
    setShareName(nextShareName);
    try {
      await updateShareSettings({
        threadId: thread.threadId,
        orgOnly: nextOrgOnly,
        shareName: nextShareName,
      });
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron guardar las opciones");
      setOrgOnly(prevOrgOnly);
      setShareName(prevShareName);
    } finally {
      setPendingSettings(false);
    }
  };

  const handleShareToggle = async () => {
    const previous = isShared;
    setIsSharedLocal(!previous);
    setPendingToggle(true);
    try {
      await handleToggleShare(thread, previous, {
        orgOnly,
        shareName,
      });
    } catch (error) {
      console.error(error);
      setIsSharedLocal(previous);
      toast.error("No se pudo actualizar el enlace compartido");
    } finally {
      setPendingToggle(false);
    }
  };

  const onCopy = async () => {
    if (!shareId) return;
    try {
      await handleCopyShareLink(shareId);
      setCopied(true);
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
      toast.success("Enlace copiado");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo copiar el enlace");
    }
  };

  const onRegenerate = async () => {
    if (!thread || !isShared) return;
    try {
      await regenerateShareLink({ threadId: thread.threadId });
      setIsSharedLocal(true);
      toast.success("Nuevo enlace generado");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo regenerar el enlace");
    }
  };

  return (
    <Dialog
      open={Boolean(thread)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800/70 dark:bg-zinc-950/90 data-[state=open]:animate-none data-[state=closed]:animate-none">
        <DialogHeader>
          <DialogTitle>Compartir conversación</DialogTitle>
          <DialogDescription>
            Configura cómo quieres compartir <strong>{thread.title}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 md:p-5 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-base font-semibold">Visibilidad del enlace</p>
                <p className="text-sm text-muted-foreground">
                  Controla quién puede acceder a la conversación y gestiona el enlace público.
                </p>
              </div>
              <Switch
                checked={isShared}
                onCheckedChange={handleShareToggle}
                disabled={pendingToggle}
                aria-label="Activar o desactivar compartir"
                className="cursor-pointer data-[state=checked]:bg-accent focus-visible:ring-accent/40 mt-1"
              />
            </div>
            <div className="flex w-full flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Label htmlFor="share-url" className="text-xs font-medium text-muted-foreground">
                  URL pública
                </Label>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input id="share-url" value={shareUrl} readOnly className="flex-1" />
                <div className="flex gap-2 sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRegenerate}
                    disabled={!isShared || pendingToggle}
                    className="cursor-pointer"
                  >
                    Regenerar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopy}
                    disabled={!shareId}
                    className="cursor-pointer"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Configuración de visibilidad</p>
              <p className="text-sm text-muted-foreground">
                Ajusta cómo se muestra la conversación compartida.
              </p>
            </div>

            <div className="space-y-3">
              <ToggleRow
                label="Solo miembros de la organización"
                description="Requiere pertenecer a tu organización para acceder."
                checked={orgOnly}
                disabled={!isShared}
                onChange={(checked) => {
                  void persistSettings(checked, shareName);
                }}
              />

              <ToggleRow
                label="Mostrar tu nombre"
                description="Agrega tu nombre como autor del enlace compartido."
                checked={shareName}
                disabled={!isShared}
                onChange={(checked) => {
                  void persistSettings(orgOnly, checked);
                }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

