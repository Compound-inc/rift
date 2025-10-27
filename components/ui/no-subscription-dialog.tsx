"use client";

import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ai/ui/dialog";
import { Button } from "@/components/ai/ui/button";

interface NoSubscriptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgName?: string | null;
}

export function NoSubscriptionDialog({
  isOpen,
  onClose,
}: NoSubscriptionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-popover-main border-border/50">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="space-y-2">
              <DialogTitle className="text-lg font-semibold text-popover-text">
                Suscripción Requerida
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Tu organización necesita una suscripción activa para continuar usando Rift
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            onClick={onClose}
            className="w-full sm:w-auto cursor-pointer"
          >
            Cerrar
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <a href="mailto:planes@rift.mx" className="flex items-center justify-center">
              Contáctanos
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
