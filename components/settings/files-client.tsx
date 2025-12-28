"use client";

import { usePaginatedQuery, useMutation, Authenticated, Unauthenticated, AuthLoading, useConvexAuth } from "convex/react";
import { useMemo, useState } from "react";
import Image from "next/image";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DataTable } from "@/components/ai/ui/data-table";
import { Button } from "@/components/ai/ui/button";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import { File, Image as ImageIcon, FileText, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ai/ui/checkbox";
import { logAttachmentDeleted, logAttachmentsBulkDeleted } from "@/actions/audit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ai/ui/alert-dialog";

interface Attachment {
  _id: string;
  publicMessageIds: string[];
  userId: string;
  attachmentType: "image" | "pdf" | "file";
  attachmentUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: string;
  fileKey: string;
  status?: "delated" | "uploaded";
  _creationTime: number;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPreview(attachment: Attachment): React.ReactNode {
  const previewSize = "h-8 w-8 rounded mr-3 flex-shrink-0";
  
  if (attachment.attachmentType === "image") {
    return (
      <div className="relative">
        <Image
          src={attachment.attachmentUrl}
          alt={attachment.fileName}
          className={`${previewSize} object-cover bg-gray-100 dark:bg-gray-800`}
          width={32}
          height={32}
          unoptimized
          onError={(e) => {
            const target = e.currentTarget as HTMLElement;
            target.style.display = 'none';
            (target.nextSibling as Element)?.classList.remove('hidden');
          }}
        />
        <div className={`${previewSize.replace('mr-3', '')} bg-gray-100 dark:bg-gray-800 flex items-center justify-center hidden absolute inset-0`}>
          <ImageIcon className="h-4 w-4 text-gray-500" />
        </div>
      </div>
    );
  } else if (attachment.attachmentType === "pdf") {
    return (
      <div className={`${previewSize} bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-600 dark:text-red-400 text-xs font-medium`}>
        PDF
      </div>
    );
  } else {
    return (
      <div className={`${previewSize} bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400`}>
        <File className="h-4 w-4" />
      </div>
    );
  }
}

export function FilesClient() {
  const { isAuthenticated } = useConvexAuth();
  const { results: attachments, status, loadMore } = usePaginatedQuery(
    api.users.getUserAttachmentsPaginated,
    isAuthenticated ? {} : "skip",
    { initialNumItems: 20 }
  );
  const deleteAttachment = useMutation(api.users.deleteAttachment);
  const bulkDeleteAttachments = useMutation(api.users.bulkDeleteAttachments);
  const [selectedIds, setSelectedIds] = useState<Id<"attachments">[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visibleAttachments = useMemo(() => {
    if (!attachments) return [] as Attachment[];
    if (hiddenIds.size === 0) return attachments as Attachment[];
    return (attachments as Attachment[]).filter(a => !hiddenIds.has(a._id));
  }, [attachments, hiddenIds]);

  const handleDelete = (attachmentId: string) => {
    setPendingDeleteId(attachmentId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      // Optimistic hide
      setHiddenIds(prev => {
        const next = new Set(prev);
        next.add(pendingDeleteId);
        return next;
      });
      try {
        // get metadata before server deletion
        const att = visibleAttachments.find(a => a._id === pendingDeleteId);
        await deleteAttachment({ attachmentId: pendingDeleteId as any });
        void logAttachmentDeleted(String(pendingDeleteId), att?.fileName, att?.mimeType, att?.fileSize);
      } catch (err) {
        // Rollback on error
        setHiddenIds(prev => {
          const next = new Set(prev);
          next.delete(pendingDeleteId);
          return next;
        });
        // Optionally surface error
        console.error("Delete failed", err);
      } finally {
        setPendingDeleteId(null);
        setDeleteDialogOpen(false);
      }
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.length > 0) {
      // Optimistic hide all selected
      const ids = [...selectedIds];
      // Clear selection immediately so the bar hides
      setSelectedIds([]);
      setClearSelectionSignal((x) => x + 1);
      setHiddenIds(prev => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      try {
        // collect meta before deletion
        const items = ids.map(id => {
          const att = visibleAttachments.find(a => a._id === id);
          return { id: String(id), name: att?.fileName, mimeType: att?.mimeType, size: att?.fileSize };
        });
        await bulkDeleteAttachments({ attachmentIds: ids as any });
        void logAttachmentsBulkDeleted(items);
      } catch (err) {
        // Rollback on error
        setHiddenIds(prev => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
        console.error("Bulk delete failed", err);
      } finally {
        setBulkDeleteDialogOpen(false);
      }
    }
  };

  const getPluralizationText = (count: number) => {
    if (count === 1) {
      return "1 archivo seleccionado";
    }
    return `${count} archivos seleccionados`;
  };

  const filesColumns: ColumnDef<Attachment, unknown>[] = [
    {
      id: "select",
      header: ({ table }: { table: Table<Attachment> }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todo"
          className="data-[state=unchecked]:bg-transparent border-border"
        />
      ),
      cell: ({ row }: { row: Row<Attachment> }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
          className="data-[state=unchecked]:bg-transparent border-border"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "fileName",
      header: "Archivo",
      cell: ({ row }: { row: Row<Attachment> }) => {
        const attachment = row.original;
        return (
          <div className="flex items-center">
            {getPreview(attachment)}
            <a 
              href={attachment.attachmentUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-sm hover:underline truncate text-gray-900 dark:text-white"
              title={attachment.fileName}
            >
              {attachment.fileName}
            </a>
          </div>
        );
      },
    },
    {
      accessorKey: "_creationTime",
      header: "Creado",
      cell: ({ row }: { row: Row<Attachment> }) => {
        const attachment = row.original;
        return <div className="text-sm text-gray-500 dark:text-text-muted">{formatDate(attachment._creationTime)}</div>;
      },
      sortingFn: (rowA: Row<Attachment>, rowB: Row<Attachment>, columnId: string) => {
        return (rowA.getValue(columnId) as number) - (rowB.getValue(columnId) as number);
      },
    },
    {
      id: "actions",
      cell: ({ row }: { row: Row<Attachment> }) => {
        const attachment = row.original;
        return (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900 dark:text-text-muted dark:hover:text-white"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              handleDelete(attachment._id);
            }}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Eliminar</span>
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-2">
      {/* Selected Bar - Outside table, right-aligned with padding below */}
      <div className="flex justify-end items-center pb-1 transition-opacity duration-200">
        <div className={`transition-opacity duration-200 ${selectedIds.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleBulkDelete}
            className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-danger/30 hover:bg-danger/40 dark:bg-danger/30 dark:hover:bg-danger/40"
          >
            Eliminar seleccionados
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <AuthLoading>
        <div className="border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Cargando archivos…</div>
        </div>
      </AuthLoading>
      <Authenticated>
        <div className="border border-gray-200 dark:border-border bg-white dark:bg-popover-secondary rounded-lg p-4">
          <DataTable 
            columns={filesColumns} 
            data={visibleAttachments}
            showSearch={false}
            showPagination={true}
            pageSize={20}
            getRowId={(row) => (row as any)._id}
            onRowSelectionChange={(selection) => setSelectedIds(Object.keys(selection) as Id<"attachments">[])}
            clearSelectionSignal={clearSelectionSignal}
            emptyStateMessage="No has subido ningún archivo adjunto aún."
            className=""
          />
        </div>
      </Authenticated>
      <Unauthenticated>
        <div className="text-center py-12 text-muted-foreground">
          Inicia sesión para ver tus archivos.
        </div>
      </Unauthenticated>

      {/* Single Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-popover-main backdrop-blur-sm border-border/50 shadow-lg max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-popover-text text-lg">Eliminar archivo</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              ¿Estás seguro de que quieres eliminar este archivo adjunto? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-transparent border-border/50 text-muted-foreground hover:bg-popover-secondary/40 hover:text-popover-text">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="bg-popover-main backdrop-blur-sm border-border/50 shadow-lg max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-popover-text text-lg">Eliminar archivos</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              ¿Estás seguro de que quieres eliminar {getPluralizationText(selectedIds.length)}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-transparent border-border/50 text-muted-foreground hover:bg-popover-secondary/40 hover:text-popover-text">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete} 
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
