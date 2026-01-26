"use client";

import { MembersTableShell } from "./MembersTableShell";
import { MembersHeaderClient } from "./MembersHeaderClient";
import type { PaginatedOrganizationData } from "@/actions/getOrganizationMembers";
import { TableBody, TableCell, TableRow } from "@/components/ai/ui/table";
import { useMemo, useState, useCallback } from "react";
import { DotsHorizontalIcon, ReloadIcon, ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Invitation as WorkOSInvitation } from "@workos-inc/node";
import { updateRole } from "@/actions/updateRole";
import { removeMember } from "@/actions/removeMember";
import { useRouter } from "next/navigation";
import { revokeInvitation } from "@/actions/revokeInvitation";
import { getPaginatedOrganizationMembers, OrganizationMembershipWithUser } from "@/actions/getOrganizationMembers";
import { Badge } from "@/components/ai/ui/badge";
import { Button } from "@/components/ai/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ai/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ai/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ai/ui/select";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

// Hoist static objects and functions outside component (rendering-hoist-jsx best practice)
const ROLE_PILL_STYLES: Record<string, string> = {
  owner: "bg-[#F3E8FF] text-[#4C1D95] border border-[#E4C7FF]/70 dark:bg-[#2B0F49] dark:text-[#E8D7FF] dark:border-[#5B21B6]/70",
  admin: "bg-[#E0ECFF] text-[#1D4ED8] border border-[#C3DAFF]/70 dark:bg-[#102347] dark:text-[#C3DAFF] dark:border-[#3B82F6]/50",
  manager: "bg-[#DEF7EC] text-[#047857] border border-[#ACEAD3]/70 dark:bg-[#0E3A2F] dark:text-[#BBF7D0] dark:border-[#10B981]/60",
  member: "bg-[#F5F5F7] text-[#3F3F46] border border-[#E4E4E7]/70 dark:bg-[#27272A] dark:text-[#E4E4E7] dark:border-[#52525B]/70",
  guest: "bg-[#FFF1DA] text-[#A8550B] border border-[#FFD4A8]/70 dark:bg-[#3B2411] dark:text-[#FFD9B0] dark:border-[#F97316]/60",
  default: "bg-muted/60 text-muted-foreground border border-border/70 dark:bg-[#1F1F22] dark:text-[#D4D4D8] dark:border-[#3F3F46]/60",
};

const STATUS_PILL_STYLES: Record<string, string> = {
  active: "bg-[#DEF7EC] text-[#047857] border border-[#ACEAD3]/70 dark:bg-[#0E3A2F] dark:text-[#BBF7D0] dark:border-[#10B981]/60",
  inactive: "bg-[#F5F5F7] text-[#3F3F46] border border-[#E4E4E7]/70 dark:bg-[#27272A] dark:text-[#E4E4E7] dark:border-[#52525B]/70",
  pending: "bg-[#FFF1DA] text-[#A8550B] border border-[#FFD4A8]/70 dark:bg-[#3B2411] dark:text-[#FFD9B0] dark:border-[#F97316]/60",
  default: "bg-muted/60 text-muted-foreground border border-border/70 dark:bg-[#1F1F22] dark:text-[#D4D4D8] dark:border-[#3F3F46]/60",
};

function getStatusLabel(status: string): string {
  switch (status) {
    case "active": return "Activo";
    case "inactive": return "Inactivo";
    case "pending": return "Pendiente";
    default: return status;
  }
}

function getRoleLabel(role: string): string {
  switch (role.toLowerCase()) {
    case "owner": return "Owner";
    case "admin": return "Admin";
    case "manager": return "Gerente";
    case "member": return "Miembro";
    case "guest": return "Invitado";
    default: return role;
  }
}

interface MembersListWithShellProps {
  initialData: PaginatedOrganizationData;
  currentUserId: string;
  seatQuantity?: number | null;
  totalMemberCount: number;
  plan?: "free" | "plus" | "pro" | "enterprise" | null;
}


export function MembersListWithShell({ 
  initialData, 
  currentUserId, 
  seatQuantity, 
  totalMemberCount, 
  plan 
}: MembersListWithShellProps) {
  const router = useRouter();
  const [data, setData] = useState<PaginatedOrganizationData>(initialData);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isUpdateRoleOpen, setIsUpdateRoleOpen] = useState(false);
  const [memberToUpdate, setMemberToUpdate] = useState<OrganizationMembershipWithUser | null>(null);
  const [newRole, setNewRole] = useState("member");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMembershipWithUser | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [invitationToRevoke, setInvitationToRevoke] = useState<WorkOSInvitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchMembers = useCallback(async (after?: string, before?: string) => {
    setLoading(true);
    try {
      const newData = await getPaginatedOrganizationMembers(50, after, before);
      setData(newData);
    } catch (e) {
      console.error("Failed to fetch members", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNextPage = useCallback(() => {
    if (data.nextCursor) {
      fetchMembers(data.nextCursor, undefined);
    }
  }, [data.nextCursor, fetchMembers]);

  const handlePrevPage = useCallback(() => {
    if (data.prevCursor) {
      fetchMembers(undefined, data.prevCursor);
    }
  }, [data.prevCursor, fetchMembers]);

  const refreshData = useCallback(() => {
    router.refresh();
    fetchMembers(undefined, undefined);
  }, [router, fetchMembers]);


  const openUpdateRoleDialog = useCallback((member: OrganizationMembershipWithUser) => {
    setMemberToUpdate(member);
    const roleSlug = typeof member.role === "object" ? member.role?.slug : member.role;
    setNewRole(roleSlug || "member");
    setUpdateError(null);
    setIsUpdateRoleOpen(true);
  }, []);

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToUpdate) return;

    setIsUpdating(true);
    setUpdateError(null);
    try {
      const result = await updateRole(memberToUpdate.id, newRole);
      if (result.success) {
        setIsUpdateRoleOpen(false);
        refreshData();
      } else {
        setUpdateError("Error al actualizar el rol: " + result.error);
      }
    } catch (error) {
      console.error(error);
      setUpdateError("Ocurrió un error inesperado");
    } finally {
      setIsUpdating(false);
    }
  };

  const openRemoveDialog = useCallback((member: OrganizationMembershipWithUser) => {
    setMemberToRemove(member);
    setRemoveError(null);
    setIsRemoveOpen(true);
  }, []);

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setIsRemoving(true);
    setRemoveError(null);
    try {
      const result = await removeMember(memberToRemove.id);
      if (result.success) {
        setIsRemoveOpen(false);
        refreshData();
      } else {
        setRemoveError("Error al eliminar el miembro: " + result.error);
      }
    } catch (error) {
      console.error(error);
      setRemoveError("Ocurrió un error inesperado");
    } finally {
      setIsRemoving(false);
    }
  };

  const openRevokeDialog = useCallback((invitation: WorkOSInvitation) => {
    setInvitationToRevoke(invitation);
    setRevokeError(null);
    setIsRevokeOpen(true);
  }, []);

  const handleRevokeInvitation = async () => {
    if (!invitationToRevoke) return;

    setIsRevoking(true);
    setRevokeError(null);
    try {
      const result = await revokeInvitation(invitationToRevoke.id);
      if (result.success) {
        setIsRevokeOpen(false);
        refreshData();
      } else {
        setRevokeError("Error al revocar la invitación: " + result.error);
      }
    } catch (error) {
      console.error(error);
      setRevokeError("Ocurrió un error inesperado");
    } finally {
      setIsRevoking(false);
    }
  };

  const processedData = useMemo(() => {
    const memberRows = data.members.map(m => ({
      id: m.id,
      name: m.user ? (m.user.firstName && m.user.lastName ? `${m.user.firstName} ${m.user.lastName}` : m.user.firstName || m.user.lastName || "Nombre Desconocido") : "Usuario Desconocido",
      email: m.user?.email || "",
      role: (typeof m.role === 'object' ? m.role?.slug : m.role) || "member",
      status: m.user?.lastSignInAt ? "active" : "inactive",
      lastActivity: m.user?.lastSignInAt || null,
      avatarUrl: m.user?.profilePictureUrl,
      rawMember: m,
      rawInvitation: null,
      isInvitation: false
    }));

    const invitationRows = data.invitations.map(i => ({
      id: i.id,
      name: i.email,
      email: i.email,
      role: "member",
      status: "pending",
      lastActivity: i.createdAt,
      avatarUrl: undefined,
      rawMember: null,
      rawInvitation: i,
      isInvitation: true
    }));

    let combined = [...memberRows, ...invitationRows];

    if (searchQuery.trim()) {
      const normalizedQuery = searchQuery.toLowerCase().trim();
      combined = combined.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(normalizedQuery);
        const emailMatch = item.email.toLowerCase().includes(normalizedQuery);
        return nameMatch || emailMatch;
      });
    }

    return combined;
  }, [data, searchQuery]);

  const rolePillStyles: Record<string, string> = {
    owner: "bg-[#F3E8FF] text-[#4C1D95] border border-[#E4C7FF]/70 dark:bg-[#2B0F49] dark:text-[#E8D7FF] dark:border-[#5B21B6]/70",
    admin: "bg-[#E0ECFF] text-[#1D4ED8] border border-[#C3DAFF]/70 dark:bg-[#102347] dark:text-[#C3DAFF] dark:border-[#3B82F6]/50",
    manager: "bg-[#DEF7EC] text-[#047857] border border-[#ACEAD3]/70 dark:bg-[#0E3A2F] dark:text-[#BBF7D0] dark:border-[#10B981]/60",
    member: "bg-[#F5F5F7] text-[#3F3F46] border border-[#E4E4E7]/70 dark:bg-[#27272A] dark:text-[#E4E4E7] dark:border-[#52525B]/70",
    guest: "bg-[#FFF1DA] text-[#A8550B] border border-[#FFD4A8]/70 dark:bg-[#3B2411] dark:text-[#FFD9B0] dark:border-[#F97316]/60",
    default: "bg-muted/60 text-muted-foreground border border-border/70 dark:bg-[#1F1F22] dark:text-[#D4D4D8] dark:border-[#3F3F46]/60",
  };

  const statusPillStyles: Record<string, string> = {
    active: "bg-[#DEF7EC] text-[#047857] border border-[#ACEAD3]/70 dark:bg-[#0E3A2F] dark:text-[#BBF7D0] dark:border-[#10B981]/60",
    inactive: "bg-[#F5F5F7] text-[#3F3F46] border border-[#E4E4E7]/70 dark:bg-[#27272A] dark:text-[#E4E4E7] dark:border-[#52525B]/70",
    pending: "bg-[#FFF1DA] text-[#A8550B] border border-[#FFD4A8]/70 dark:bg-[#3B2411] dark:text-[#FFD9B0] dark:border-[#F97316]/60",
    default: "bg-muted/60 text-muted-foreground border border-border/70 dark:bg-[#1F1F22] dark:text-[#D4D4D8] dark:border-[#3F3F46]/60",
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Activo";
      case "inactive": return "Inactivo";
      case "pending": return "Pendiente";
      default: return status;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner": return "Owner";
      case "admin": return "Admin";
      case "manager": return "Gerente";
      case "member": return "Miembro";
      case "guest": return "Invitado";
      default: return role;
    }
  };

  return (
    <>

      {/* Update Role Dialog */}
      <Dialog open={isUpdateRoleOpen} onOpenChange={setIsUpdateRoleOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl">
          <div className="space-y-6 p-2">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                Actualizar rol
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                Selecciona el nuevo rol para {memberToUpdate?.user ? `${memberToUpdate.user.firstName} ${memberToUpdate.user.lastName}` : "este miembro"}.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleUpdateRole} className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground dark:text-popover-text">
                  Rol
                </label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="cursor-pointer border border-border/60 bg-white/50 dark:bg-popover-main/50 focus:border-primary/50 w-full mt-2">
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent 
                    className="min-w-[190px] rounded-2xl border border-border/60 bg-white/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-sm dark:bg-popover-secondary/85"
                  >
                    <SelectItem value="member" className="cursor-pointer rounded-xl px-3 py-2 mb-1 text-sm font-medium text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-hover/40">Miembro</SelectItem>
                    <SelectItem value="admin" className="cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-hover/40">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {updateError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <ExclamationTriangleIcon className="size-4 shrink-0" />
                  <span>{updateError}</span>
                </div>
              )}
              
              <div className="flex justify-end pt-2 gap-2">
                <Button type="button" onClick={() => setIsUpdateRoleOpen(false)} className="cursor-pointer rounded-lg">
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isUpdating}
                  className="cursor-pointer rounded-lg font-medium gap-2 min-w-[120px]"
                >
                  {isUpdating ? "Actualizando" : "Actualizar"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl">
          <div className="space-y-6 p-2">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-destructive dark:text-destructive">
                Eliminar miembro
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                ¿Estás seguro que deseas eliminar a {memberToRemove?.user ? `${memberToRemove.user.firstName} ${memberToRemove.user.lastName}` : "este miembro"} de la organización? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            
            {removeError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <ExclamationTriangleIcon className="size-4 shrink-0" />
                <span>{removeError}</span>
              </div>
            )}

            <div className="flex justify-end pt-4 gap-2">
              <Button type="button" onClick={() => setIsRemoveOpen(false)} className="cursor-pointer rounded-lg">
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleRemoveMember}
                disabled={isRemoving}
                className="cursor-pointer rounded-lg font-medium gap-2 min-w-[120px]"
              >
                {isRemoving ? "Eliminando" : "Eliminar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke Invitation Dialog */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl">
          <div className="space-y-6 p-2">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-destructive dark:text-destructive">
                Revocar invitación
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                ¿Estás seguro que deseas revocar la invitación para {invitationToRevoke?.email}?
              </DialogDescription>
            </DialogHeader>
            
            {revokeError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <ExclamationTriangleIcon className="size-4 shrink-0" />
                <span>{revokeError}</span>
              </div>
            )}

            <div className="flex justify-end pt-4 gap-2">
              <Button type="button" onClick={() => setIsRevokeOpen(false)} className="cursor-pointer rounded-lg">
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleRevokeInvitation}
                disabled={isRevoking}
                className="cursor-pointer rounded-lg font-medium gap-2 min-w-[120px]"
              >
                {isRevoking ? "Revocando" : "Revocar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Use shell with dynamic content */}
      <MembersTableShell
        headerContent={
          <MembersHeaderClient
            seatQuantity={seatQuantity}
            totalMemberCount={totalMemberCount}
            plan={plan}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={refreshData}
          />
        }
        paginationContent={
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevPage}
              disabled={!data.prevCursor || loading}
              className="gap-2 border border-border/60 bg-white/90 dark:bg-popover-secondary/75 dark:shadow-black/30 hover:bg-black/[0.04] dark:hover:bg-hover/30 hover:text-foreground dark:hover:text-popover-text disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextPage}
              disabled={!data.nextCursor || loading}
              className="gap-2 border border-border/60 bg-white/90 dark:bg-popover-secondary/75 dark:shadow-black/30 hover:bg-black/[0.04] dark:hover:bg-hover/30 hover:text-foreground dark:hover:text-popover-text disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                <ReloadIcon className="mr-2 size-4 animate-spin inline" /> Cargando...
              </TableCell>
            </TableRow>
          ) : (
            <>
              {processedData.map((item, index) => {
                const name = item.name;
                const email = item.email;
                const role = item.role;
                const isCurrentUser = item.isInvitation ? false : item.rawMember?.userId === currentUserId;
                
                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "border-border/50 transition",
                      index % 2 === 0 ? "bg-black/0 dark:bg-transparent" : "bg-black/[0.015] dark:bg-transparent",
                      "hover:bg-black/[0.04] dark:hover:bg-hover/30",
                    )}
                  >
                    <TableCell className="pl-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {name}
                          {isCurrentUser && <span className="ml-2 text-xs text-muted-foreground">(Tú)</span>}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{email}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px] font-medium uppercase",
                          ROLE_PILL_STYLES[(role ?? "default").toLowerCase()] ?? ROLE_PILL_STYLES.default,
                        )}
                      >
                        {getRoleLabel(role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px] font-medium uppercase",
                          STATUS_PILL_STYLES[item.status] ?? STATUS_PILL_STYLES.default,
                        )}
                      >
                        {getStatusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isCurrentUser}
                            className="cursor-pointer text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-hover/40 disabled:opacity-50"
                          >
                            <span className="sr-only">Abrir acciones</span>
                            <DotsHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[190px] rounded-2xl border border-border/60 bg-white/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-sm dark:bg-popover-secondary/85"
                        >
                          {item.isInvitation ? (
                            <DropdownMenuItem
                              variant="destructive"
                              className="cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 focus:text-destructive"
                              onClick={() => openRevokeDialog(item.rawInvitation!)}
                            >
                              Revocar invitación
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem 
                                className="cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-hover/40"
                                onClick={() => openUpdateRoleDialog(item.rawMember!)}
                              >
                                Actualizar rol
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 focus:text-destructive"
                                onClick={() => openRemoveDialog(item.rawMember!)}
                              >
                                Eliminar miembro
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}

              {processedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    No hay miembros que coincidan con tu búsqueda.
                  </TableCell>
                </TableRow>
              )}
            </>
          )}
        </TableBody>
      </MembersTableShell>
    </>
  );
}
