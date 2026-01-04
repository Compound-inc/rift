import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ai/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "../ai/ui/dialog";
import { MessageSquarePlus, PlusIcon } from "lucide-react";
import { InstructionForm } from "./InstructionForm";
import { InstructionCard } from "./InstructionCard";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth } from "convex/react";
import { SettingsSection, SettingsDivider } from "@/components/settings";

type InstructionItem = {
  _id: Id<"customInstructions">;
  _creationTime: number;
  title: string;
  description: string;
  icon: string;
  iconColor?: string;
  instructions: string;
  ownerId: string;
  orgId?: string;
  isSharedWithOrg: boolean;
  createdAt: number;
  updatedAt: number;
  ownerName: string;
};

function InstructionGrid({
  items,
  emptyMessage,
  currentUserId,
  onEdit,
}: {
  items: InstructionItem[];
  emptyMessage: string;
  currentUserId: string;
  onEdit: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-2 items-stretch">
      {items.map((instruction) => (
        <InstructionCard
          key={instruction._id}
          instruction={instruction}
          currentUserId={currentUserId}
          onEdit={() => onEdit(instruction._id)}
        />
      ))}
      {items.length === 0 && (
        <div className="col-span-full text-center py-10 px-4 text-sm text-muted-foreground border border-dashed rounded-3xl bg-muted/20">
          <MessageSquarePlus className="h-8 w-8 mx-auto mb-3 opacity-20" />
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

export function InstructionManager() {
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const instructions = useQuery(
    api.customInstructions.list,
    isAuthenticated ? {} : "skip"
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!user) return null;

  const myInstructions = instructions?.filter(i => i.ownerId === user.id) || [];
  const sharedWithMe = instructions?.filter(i => i.ownerId !== user.id && !i.isSharedWithOrg) || [];
  const orgInstructions = instructions?.filter(i => i.ownerId !== user.id && i.isSharedWithOrg) || [];

  const editingInstruction = instructions?.find((i) => i._id === editingId);

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <SettingsSection 
        title="Mis Instrucciones" 
        description="Instrucciones creadas por ti para tu uso personal o para compartir."
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => setEditingId(null)}
                  className="cursor-pointer gap-2 rounded-md border border-border/60 bg-white/90 shadow-sm shadow-black/5 dark:bg-popover-secondary/75 dark:shadow-black/30 hover:bg-black/[0.04] dark:hover:bg-hover/30 hover:text-foreground dark:hover:text-popover-text disabled:opacity-50 disabled:cursor-not-allowed h-9 px-4 text-sm font-medium"
                >
                  <PlusIcon className="size-4" />
                  <span className="hidden sm:inline">Nueva Instrucción</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl rounded-2xl border border-border/50 bg-white/95 dark:bg-popover-main shadow-2xl dark:shadow-2xl">
                <div className="space-y-6 p-2">
                  <DialogHeader className="space-y-2">
                    <DialogTitle className="text-2xl font-bold text-foreground dark:text-popover-text">
                      {editingId ? "Editar Instrucción" : "Crear Instrucción"}
                    </DialogTitle>
                    <p className="text-base text-muted-foreground leading-relaxed">
                      {editingId ? "Modifica tu instrucción personalizada." : "Crea una nueva instrucción para tus chats."}
                    </p>
                  </DialogHeader>
                  <InstructionForm
                    initialData={editingInstruction}
                    onSuccess={handleClose}
                    onCancel={handleClose}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <InstructionGrid 
            items={myInstructions}
            emptyMessage="No has creado instrucciones todavía. Crea una para personalizar tus respuestas."
            currentUserId={user.id}
            onEdit={handleEdit}
          />
        </div>
      </SettingsSection>
      
      <SettingsDivider />

      <SettingsSection 
        title="Compartidas conmigo" 
        description="Instrucciones compartidas directamente contigo por otros usuarios."
      >
        <InstructionGrid 
          items={sharedWithMe}
          emptyMessage="Nadie ha compartido instrucciones directamente contigo aún."
          currentUserId={user.id}
          onEdit={handleEdit}
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection 
        title="Instrucciones de la Organización" 
        description="Instrucciones disponibles para todos los miembros de tu organización."
      >
        <InstructionGrid 
          items={orgInstructions}
          emptyMessage="No hay instrucciones globales en tu organización actualmente."
          currentUserId={user.id}
          onEdit={handleEdit}
        />
      </SettingsSection>
    </div>
  );
}
