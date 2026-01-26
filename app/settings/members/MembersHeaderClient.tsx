"use client";

import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ai/ui/input";
import { Button } from "@/components/ai/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ai/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ai/ui/select";
import { useState } from "react";
import { PlusIcon, CheckCircledIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { inviteUser } from "@/actions/inviteUser";

interface InvitationFormData {
  email: string;
  role: string;
}

interface MembersHeaderClientProps {
  seatQuantity?: number | null;
  totalMemberCount: number;
  plan?: "free" | "plus" | "pro" | "enterprise" | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
}

export function MembersHeaderClient({
  seatQuantity,
  totalMemberCount,
  plan,
  searchQuery,
  onSearchChange,
  onRefresh,
}: MembersHeaderClientProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [invitationForms, setInvitationForms] = useState<InvitationFormData[]>([{ email: "", role: "member" }]);
  const [isInviting, setIsInviting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const isLimitReached = typeof seatQuantity === 'number' && totalMemberCount >= seatQuantity;

  const handleAddInvitation = () => {
    const currentCount = totalMemberCount + invitationForms.length;
    if (typeof seatQuantity === 'number' && currentCount >= seatQuantity) {
      return;
    }
    if (invitationForms.length < 10) {
      setInvitationForms([...invitationForms, { email: "", role: "member" }]);
    }
  };

  const handleInvitationChange = (index: number, field: keyof InvitationFormData, value: string) => {
    const newInvitations = [...invitationForms];
    newInvitations[index] = { ...newInvitations[index], [field]: value };
    setInvitationForms(newInvitations);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteError(null);

    try {
      const results = await Promise.all(
        invitationForms
          .filter(inv => inv.email.trim())
          .map(inv => inviteUser(inv.email, inv.role))
      );

      const hasErrors = results.some(r => !r.success);
      if (hasErrors) {
        const errorMessages = results
          .filter(r => !r.success)
          .map(r => r.error)
          .join(", ");
        setInviteError(`Algunas invitaciones fallaron: ${errorMessages}`);
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
    } catch (error) {
      setInviteError("Ocurrió un error inesperado al enviar las invitaciones");
    } finally {
      setIsInviting(false);
    }
  };

  const resetInviteState = () => {
    setInvitationForms([{ email: "", role: "member" }]);
    setIsSuccess(false);
    setInviteError(null);
  };

  const closeInviteDialog = () => {
    setIsInviteOpen(false);
    setTimeout(() => {
      resetInviteState();
    }, 200);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-transparent border-none">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {typeof seatQuantity === 'number' 
            ? `${totalMemberCount}/${seatQuantity} ${totalMemberCount === 1 ? "miembro" : "miembros"}`
            : `${totalMemberCount} ${totalMemberCount === 1 ? "miembro" : "miembros"}`
          }
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <div className="pointer-events-none absolute inset-0 rounded-md border border-border/60 bg-white/90 shadow-sm shadow-black/5 dark:bg-popover-secondary/75 dark:shadow-black/30" />
          <MagnifyingGlassIcon className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 z-[1] size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar por correo..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="relative z-[1] !border-none !bg-transparent dark:!bg-transparent rounded-md pl-9 focus:outline-none focus:ring-0"
          />
        </div>
        <Dialog open={isInviteOpen} onOpenChange={(open) => {
          if (isLimitReached && open) return;
          setIsInviteOpen(open);
          if (!open) {
            setTimeout(() => {
              resetInviteState();
            }, 200);
          }
        }}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost"
              disabled={isLimitReached || plan !== "enterprise"}
              className="gap-2 border border-border/60 bg-white/90 dark:bg-popover-secondary/75 dark:shadow-black/30 hover:bg-black/[0.04] dark:hover:bg-hover/30 hover:text-foreground dark:hover:text-popover-text disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Invitar Miembros</span>
              <span className="sm:hidden">Invitar</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl dark:shadow-2xl">
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                  <CheckCircledIcon className="size-12 text-green-600 dark:text-green-400" />
                </div>
                <div className="space-y-2">
                  <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                    ¡Invitaciones enviadas!
                  </DialogTitle>
                  <DialogDescription className="text-base text-muted-foreground max-w-md">
                    Hemos enviado las invitaciones correctamente.
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <Button onClick={resetInviteState} className="cursor-pointer rounded-lg font-medium">
                    Invitar a más
                  </Button>
                  <Button onClick={closeInviteDialog} className="cursor-pointer rounded-lg font-medium min-w-[100px]">
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 p-2">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                    Invitar a nuevos miembros
                  </DialogTitle>
                  <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                    Escribe el correo y selecciona el rol para cada nuevo miembro.
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="grid grid-cols-[1fr_200px] gap-4 mb-2">
                    <label className="text-sm font-medium text-foreground dark:text-popover-text">
                      Correo electrónico
                    </label>
                    <label className="text-sm font-medium text-foreground dark:text-popover-text">
                      Rol
                    </label>
                  </div>
                  
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
                    {invitationForms.map((invitation, index) => (
                      <div key={index} className="grid grid-cols-[1fr_200px] gap-4 items-start">
                        <Input
                          placeholder="usuario@ejemplo.com"
                          type="email"
                          value={invitation.email}
                          onChange={(e) => handleInvitationChange(index, "email", e.target.value)}
                          required={index === 0} 
                          className="bg-white/50 dark:bg-popover-main/50 border-border/60 focus:border-primary/50"
                        />
                        <Select 
                          value={invitation.role} 
                          onValueChange={(value) => handleInvitationChange(index, "role", value)}
                        >
                          <SelectTrigger className="cursor-pointer border border-border/60 bg-white/50 dark:bg-popover-main/50 focus:border-primary/50 w-full">
                            <SelectValue placeholder="Selecciona un rol" />
                          </SelectTrigger>
                          <SelectContent 
                            className="min-w-[190px] rounded-2xl border border-border/60 bg-white/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-sm dark:bg-popover-secondary/85"
                          >
                            <SelectItem value="member" className="cursor-pointer rounded-xl px-3 py-2 mb-1 text-sm font-medium text-foreground/80 hover:bg-black/5] dark:hover:bg-hover/40">Miembro</SelectItem>
                            <SelectItem value="admin" className="cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-black/5 dark:hover:bg-hover/40">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={handleAddInvitation}
                      disabled={
                        invitationForms.length >= 10 || 
                        (typeof seatQuantity === 'number' && (totalMemberCount + invitationForms.length) >= seatQuantity)
                      }
                      className="cursor-pointer rounded-lg font-medium gap-2 min-w-[150px]"
                    >
                      <PlusIcon className="size-4" />
                      Añadir más
                    </Button>
                  </div>
                  
                  <div className="pt-4 border-t border-border/30 space-y-3">
                    {inviteError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <ExclamationTriangleIcon className="size-4 shrink-0" />
                        <span>{inviteError}</span>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={isInviting}
                        className="cursor-pointer rounded-lg font-medium gap-2 min-w-[150px]"
                      >
                        {isInviting ? "Enviando" : "Enviar Invitaciones"}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
