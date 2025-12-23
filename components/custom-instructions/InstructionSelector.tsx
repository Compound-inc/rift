import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ai/ui/command";
import { PromptInputButton } from "@/components/ai/prompt-input";
import * as LucideIcons from "lucide-react";
import {
  Check,
  type LucideIcon,
  MessageSquare,
  Slash,
  Settings2,
  PlusIcon,
} from "lucide-react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useConvexAuth } from "convex/react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface InstructionSelectorProps {
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  disabled?: boolean;
}

export function InstructionSelector({
  selectedId,
  onSelect,
  disabled,
}: InstructionSelectorProps) {
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const instructions = useQuery(
    api.customInstructions.list,
    isAuthenticated ? {} : "skip"
  );
  const [open, setOpen] = useState(false);

  const isLoading = instructions === undefined;
  const loadedInstructions = instructions ?? [];

  const hasInstructions = loadedInstructions.length > 0;
  const myInstructions = loadedInstructions.filter((i) => i.ownerId === user?.id);
  const sharedWithMe = loadedInstructions.filter(
    (i) => i.ownerId !== user?.id && !i.isSharedWithOrg,
  );
  const orgInstructions = loadedInstructions.filter(
    (i) => i.ownerId !== user?.id && i.isSharedWithOrg,
  );

  const selectedInstruction = loadedInstructions.find((i) => i._id === selectedId);
  const showMy = myInstructions.length > 0;
  const showShared = sharedWithMe.length > 0;
  const showOrg = orgInstructions.length > 0;
  const hasAnyListSections = showMy || showShared || showOrg;

  return (
    <>
      <PromptInputButton
        disabled={disabled || isLoading}
        variant="ghost"
        className={cn("text-secondary hover:bg-popover-main hover:text-popover-text dark:hover:bg-hover/60 transition-none")}
        title={
          selectedInstruction
            ? `Instrucción: ${selectedInstruction.title}`
            : "Configurar instrucciones"
        }
        onClick={() => {
          if (disabled || isLoading) return;
          setOpen(true);
        }}
      >
        <Settings2 className="size-4" />
      </PromptInputButton>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Instrucciones personalizadas"
        description="Selecciona una instrucción para aplicar a este mensaje."
        className="p-0 sm:max-w-[640px]"
      >
        <CommandInput placeholder="Buscar instrucciones..." />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>
            <div className="py-6 px-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No encontramos coincidencias.
              </p>
              <Link
                href="/settings/custom-instructions"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                onClick={() => setOpen(false)}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Administrar instrucciones
              </Link>
            </div>
          </CommandEmpty>

          <CommandGroup>
            <CommandItem
              onSelect={() => {
                onSelect(undefined);
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1">
                <Slash className="h-4 w-4 text-muted-foreground" />
                <span>{selectedId ? "Desactivar instrucción" : "Sin instrucción seleccionada"}</span>
              </div>
              {!selectedId && <Check className="h-4 w-4 ml-auto" />}
            </CommandItem>
          </CommandGroup>

          {hasAnyListSections && <CommandSeparator />}

          {showMy && (
            <>
              <CommandGroup heading="Mis instrucciones">
                {myInstructions.map((inst) => {
                  const Icon =
                    ((LucideIcons as any)[inst.icon] as LucideIcon) ??
                    MessageSquare;
                  return (
                    <CommandItem
                      key={inst._id}
                      onSelect={() => {
                        onSelect(inst._id);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Icon
                          className="h-4 w-4"
                          style={{ color: inst.iconColor || "currentColor" }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium line-clamp-1">
                            {inst.title}
                          </span>
                        </div>
                      </div>
                      {selectedId === inst._id && (
                        <Check className="h-4 w-4 ml-auto" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {(showShared || showOrg) && <CommandSeparator />}
            </>
          )}

          {showShared && (
            <>
              <CommandGroup heading="Compartidas conmigo">
                {sharedWithMe.map((inst) => {
                  const Icon =
                    ((LucideIcons as any)[inst.icon] as LucideIcon) ??
                    MessageSquare;
                  return (
                    <CommandItem
                      key={inst._id}
                      onSelect={() => {
                        onSelect(inst._id);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Icon
                          className="h-4 w-4"
                          style={{ color: inst.iconColor || "currentColor" }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium line-clamp-1">
                            {inst.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">
                            de {inst.ownerName}
                          </span>
                        </div>
                      </div>
                      {selectedId === inst._id && (
                        <Check className="h-4 w-4 ml-auto" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {showOrg && <CommandSeparator />}
            </>
          )}

          {showOrg && (
            <CommandGroup heading="Organización">
              {orgInstructions.map((inst) => {
                const Icon =
                  ((LucideIcons as any)[inst.icon] as LucideIcon) ??
                  MessageSquare;
                return (
                  <CommandItem
                    key={inst._id}
                    onSelect={() => {
                      onSelect(inst._id);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Icon
                        className="h-4 w-4"
                        style={{ color: inst.iconColor || "currentColor" }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium line-clamp-1">
                          {inst.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                          de {inst.ownerName}
                        </span>
                      </div>
                    </div>
                    {selectedId === inst._id && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>

        <CommandSeparator />
        <div className="p-2 border-t bg-muted/20">
          {!hasInstructions && (
            <Link
              href="/settings/custom-instructions"
              className="flex items-center gap-2 px-2 py-1.5 mb-1 text-xs font-medium text-foreground transition-none rounded-sm "
              onClick={() => setOpen(false)}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Crear mi primera instrucción
            </Link>
          )}
          <Link
            href="/settings/custom-instructions"
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-none rounded-sm"
            onClick={() => setOpen(false)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Administrar instrucciones
          </Link>
        </div>
      </CommandDialog>
    </>
  );
}
