"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { CaretDownIcon, CaretSortIcon, CaretUpIcon, DotsHorizontalIcon, MagnifyingGlassIcon, PlusIcon, CheckCircledIcon, ExclamationTriangleIcon, ReloadIcon, ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons"
import { OrganizationMembership, User, Invitation as WorkOSInvitation } from "@workos-inc/node"
import { inviteUser } from "@/actions/inviteUser"
import { updateRole } from "@/actions/updateRole"
import { removeMember } from "@/actions/removeMember"
import { useRouter } from "next/navigation"
import { revokeInvitation } from "@/actions/revokeInvitation"
import { getPaginatedOrganizationMembers, PaginatedOrganizationData, OrganizationMembershipWithUser } from "@/actions/getOrganizationMembers"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ai/ui/avatar"
import { Badge } from "@/components/ai/ui/badge"
import { Button } from "@/components/ai/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ai/ui/select"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ai/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ai/ui/dropdown-menu"
import { Input } from "@/components/ai/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ai/ui/table"
import { cn } from "@/lib/utils"

interface MembersListProps {
  initialData: PaginatedOrganizationData
  currentUserId: string
  seatQuantity?: number | null
  totalMemberCount: number
  plan?: "free" | "plus" | "pro" | "enterprise" | null
}

interface InvitationFormData {
  email: string
  role: string
}

export function MembersList({ initialData, currentUserId, seatQuantity, totalMemberCount, plan }: MembersListProps) {
  const router = useRouter()
  const [data, setData] = useState<PaginatedOrganizationData>(initialData)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [isInviteOpen, setIsInviteOpen] = useState(false)
  
  // State for invite dialog
  const [invitationForms, setInvitationForms] = useState<InvitationFormData[]>([
    { email: "", role: "member" }
  ])
  const [isInviting, setIsInviting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // State for update role dialog
  const [isUpdateRoleOpen, setIsUpdateRoleOpen] = useState(false)
  const [memberToUpdate, setMemberToUpdate] = useState<OrganizationMembershipWithUser | null>(null)
  const [newRole, setNewRole] = useState("member")
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // State for remove member dialog
  const [isRemoveOpen, setIsRemoveOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMembershipWithUser | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // State for revoke invitation
  const [isRevokeOpen, setIsRevokeOpen] = useState(false)
  const [invitationToRevoke, setInvitationToRevoke] = useState<WorkOSInvitation | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const isLimitReached = typeof seatQuantity === 'number' && totalMemberCount >= seatQuantity;

  const fetchMembers = useCallback(async (after?: string, before?: string) => {
    setLoading(true)
    try {
        const newData = await getPaginatedOrganizationMembers(50, after, before)
        setData(newData)
    } catch (e) {
        console.error("Failed to fetch members", e)
    } finally {
        setLoading(false)
    }
  }, [])

  const handleNextPage = () => {
    if (data.nextCursor) {
        fetchMembers(data.nextCursor, undefined)
    }
  }

  const handlePrevPage = () => {
    if (data.prevCursor) {
        fetchMembers(undefined, data.prevCursor)
    }
  }
  
  const refreshData = () => {
      router.refresh()
      fetchMembers(undefined, undefined)
  }

  const handleAddInvitation = () => {
    const currentCount = totalMemberCount + invitationForms.length;
    
    if (typeof seatQuantity === 'number' && currentCount >= seatQuantity) {
      return;
    }

    if (invitationForms.length < 10) {
      setInvitationForms([...invitationForms, { email: "", role: "member" }])
    }
  }

  const handleInvitationChange = (index: number, field: keyof InvitationFormData, value: string) => {
    const newInvitations = [...invitationForms]
    newInvitations[index] = { ...newInvitations[index], [field]: value }
    setInvitationForms(newInvitations)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviting(true)
    setInviteError(null)
    
    try {
      const validInvitations = invitationForms.filter(inv => inv.email.trim() !== "")

      // Client-side check before sending
      if (typeof seatQuantity === 'number') {
          const availableSeats = seatQuantity - totalMemberCount;
          
          if (validInvitations.length > availableSeats) {
              setInviteError(`No puedes enviar ${validInvitations.length} invitaciones. Solo tienes ${availableSeats} asiento${availableSeats !== 1 ? 's' : ''} disponible${availableSeats !== 1 ? 's' : ''}.`);
              setIsInviting(false);
              return;
          }
      }

      const results = await Promise.all(
        validInvitations
          .map(inv => inviteUser(inv.email, inv.role))
      )

      const failures = results.filter(r => !r.success)
      
      if (failures.length === 0) {
        setIsSuccess(true)
        refreshData()
      } else {
        const firstError = failures[0].error
        if (firstError && firstError.includes("Email already invited")) {
           setInviteError("El correo electrónico ya ha sido invitado.")
        } else {
           setInviteError(`Error al enviar la invitación: ${firstError || "Error desconocido"}`)
        }
      }
    } catch (error) {
      console.error(error)
      setInviteError("Ocurrió un error inesperado al procesar las invitaciones.")
    } finally {
      setIsInviting(false)
    }
  }
  
  const resetInviteState = () => {
    setIsSuccess(false)
    setInviteError(null)
    setInvitationForms([{ email: "", role: "member" }])
  }

  const closeInviteDialog = () => {
    setIsInviteOpen(false)
    setTimeout(() => {
      resetInviteState()
    }, 200)
  }

  const openUpdateRoleDialog = (member: OrganizationMembershipWithUser) => {
    setMemberToUpdate(member)
    const roleSlug = typeof member.role === "object" ? member.role?.slug : member.role
    setNewRole(roleSlug || "member")
    setUpdateError(null)
    setIsUpdateRoleOpen(true)
  }

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberToUpdate) return

    setIsUpdating(true)
    setUpdateError(null)
    try {
      const result = await updateRole(memberToUpdate.id, newRole)
      if (result.success) {
        setIsUpdateRoleOpen(false)
        refreshData()
      } else {
        setUpdateError("Error al actualizar el rol: " + result.error)
      }
    } catch (error) {
      console.error(error)
      setUpdateError("Ocurrió un error inesperado")
    } finally {
      setIsUpdating(false)
    }
  }

  const openRemoveDialog = (member: OrganizationMembershipWithUser) => {
    setMemberToRemove(member)
    setRemoveError(null)
    setIsRemoveOpen(true)
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return

    setIsRemoving(true)
    setRemoveError(null)
    try {
      const result = await removeMember(memberToRemove.id)
      if (result.success) {
        setIsRemoveOpen(false)
        refreshData()
      } else {
        setRemoveError("Error al eliminar el miembro: " + result.error)
      }
    } catch (error) {
      console.error(error)
      setRemoveError("Ocurrió un error inesperado")
    } finally {
      setIsRemoving(false)
    }
  }

  const openRevokeDialog = (invitation: WorkOSInvitation) => {
    setInvitationToRevoke(invitation)
    setRevokeError(null)
    setIsRevokeOpen(true)
  }

  const handleRevokeInvitation = async () => {
    if (!invitationToRevoke) return

    setIsRevoking(true)
    setRevokeError(null)
    try {
      const result = await revokeInvitation(invitationToRevoke.id)
      if (result.success) {
        setIsRevokeOpen(false)
        refreshData()
      } else {
        setRevokeError("Error al revocar la invitación: " + result.error)
      }
    } catch (error) {
      console.error(error)
      setRevokeError("Ocurrió un error inesperado")
    } finally {
      setIsRevoking(false)
    }
  }

  // Mapping data for render with client-side search filtering
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
    }))

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
    }))

    // Combine members and invitations
    let combined = [...memberRows, ...invitationRows]

    // Client-side search filtering by name or email
    if (searchQuery.trim()) {
      const normalizedQuery = searchQuery.toLowerCase().trim()
      combined = combined.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(normalizedQuery)
        const emailMatch = item.email.toLowerCase().includes(normalizedQuery)
        return nameMatch || emailMatch
      })
    }

    return combined
  }, [data, searchQuery])

  const rolePillStyles: Record<string, string> = {
    owner: "bg-[#F3E8FF] text-[#4C1D95] border border-[#E4C7FF]/70 dark:bg-[#2B0F49] dark:text-[#E8D7FF] dark:border-[#5B21B6]/70",
    admin: "bg-[#E0ECFF] text-[#1D4ED8] border border-[#C3DAFF]/70 dark:bg-[#102347] dark:text-[#C3DAFF] dark:border-[#3B82F6]/50",
    manager: "bg-[#DEF7EC] text-[#047857] border border-[#ACEAD3]/70 dark:bg-[#0E3A2F] dark:text-[#BBF7D0] dark:border-[#10B981]/60",
    member: "bg-[#F5F5F7] text-[#3F3F46] border border-[#E4E4E7]/70 dark:bg-[#27272A] dark:text-[#E4E4E7] dark:border-[#52525B]/70",
    guest: "bg-[#FFF1DA] text-[#A8550B] border border-[#FFD4A8]/70 dark:bg-[#3B2411] dark:text-[#FFD9B0] dark:border-[#F97316]/60",
    default: "bg-muted/60 text-muted-foreground border border-border/70 dark:bg-[#1F1F22] dark:text-[#D4D4D8] dark:border-[#3F3F46]/60",
  }

  const statusPillStyles: Record<string, string> = {
    active: "bg-[#DEF7EC] text-[#047857] border border-[#ACEAD3]/70 dark:bg-[#0E3A2F] dark:text-[#BBF7D0] dark:border-[#10B981]/60",
    inactive: "bg-[#F5F5F7] text-[#3F3F46] border border-[#E4E4E7]/70 dark:bg-[#27272A] dark:text-[#E4E4E7] dark:border-[#52525B]/70",
    pending: "bg-[#FFF1DA] text-[#A8550B] border border-[#FFD4A8]/70 dark:bg-[#3B2411] dark:text-[#FFD9B0] dark:border-[#F97316]/60",
    default: "bg-muted/60 text-muted-foreground border border-border/70 dark:bg-[#1F1F22] dark:text-[#D4D4D8] dark:border-[#3F3F46]/60",
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Activo"
      case "inactive": return "Inactivo"
      case "pending": return "Pendiente"
      default: return status
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner": return "Owner"
      case "admin": return "Admin"
      case "manager": return "Gerente"
      case "member": return "Miembro"
      case "guest": return "Invitado"
      default: return role
    }
  }

  return (
    <div className="space-y-2">
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="relative z-[1] !border-none !bg-transparent dark:!bg-transparent rounded-md pl-9 focus:outline-none focus:ring-0"
              />
            </div>
            <Dialog open={isInviteOpen} onOpenChange={(open) => {
              if (isLimitReached && open) return
              setIsInviteOpen(open)
              if (!open) {
                setTimeout(() => {
                  resetInviteState()
                }, 200)
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
              {/* Dialog Content for Invite */}
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
      
      {/* ... Update/Remove/Revoke Dialogs ... */}
      {/* Update Role Dialog */}
      <Dialog open={isUpdateRoleOpen} onOpenChange={setIsUpdateRoleOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl">
          {/* ... Content same as before ... */}
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

      <div className="rounded-2xl border border-border/60 bg-white/95 shadow-lg shadow-black/5 backdrop-blur-sm dark:bg-popover-secondary/80 dark:shadow-black/30 overflow-hidden">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="text-muted-foreground border-b border-border/50 bg-gradient-to-r from-white/90 via-white/70 to-white/40 dark:from-transparent dark:via-transparent dark:to-transparent">
              <TableHead className="w-0 pr-0"><span className="sr-only">Avatar</span></TableHead>
              <TableHead><span className="text-xs font-semibold uppercase tracking-wide">Usuario</span></TableHead>
              <TableHead><span className="text-xs font-semibold uppercase tracking-wide">Correo</span></TableHead>
              <TableHead><span className="text-xs font-semibold uppercase tracking-wide">Rol</span></TableHead>
              <TableHead><span className="text-xs font-semibold uppercase tracking-wide">Estado</span></TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
               <TableRow>
                 <TableCell colSpan={6} className="h-24 text-center">
                   <ReloadIcon className="mr-2 size-4 animate-spin inline" /> Cargando...
                 </TableCell>
               </TableRow>
            ) : (
            <>
            {processedData.map((item, index) => {
              const name = item.name
              const email = item.email
              const profilePictureUrl = item.avatarUrl
              const role = item.role
              const isCurrentUser = item.isInvitation ? false : item.rawMember?.userId === currentUserId
              
              return (
                <TableRow
                  key={item.id}
                  className={cn(
                    "border-border/50 transition",
                    index % 2 === 0 ? "bg-black/0 dark:bg-transparent" : "bg-black/[0.015] dark:bg-transparent",
                    "hover:bg-black/[0.04] dark:hover:bg-hover/30",
                  )}
                >
                  <TableCell className="pr-0">
                    <Avatar className="shadow-sm shadow-black/5 ring-1 ring-border/80">
                      <AvatarImage src={profilePictureUrl || undefined} alt={name} />
                      <AvatarFallback className="bg-muted text-xs font-semibold uppercase text-muted-foreground dark:bg-black/40">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
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
                        rolePillStyles[(role ?? "default").toLowerCase()] ?? rolePillStyles.default,
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
                        statusPillStyles[item.status] ?? statusPillStyles.default,
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
              )
            })}

            {processedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No hay miembros que coincidan con tu búsqueda.
                </TableCell>
              </TableRow>
            )}
            </>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination Controls */}
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
    </div>
  )
}
