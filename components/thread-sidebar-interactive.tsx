"use client";

import { usePreloadedQuery, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ai/ui/button";
import { CheckIcon, AlertTriangleIcon } from "lucide-react";
import { EditIcon, DeleteIcon, PinIcon } from "@/components/ui/icons/svg-icons";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Preloaded } from "convex/react";
import { Loader } from "@/components/ai/loader";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ai/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ai/ui/context-menu";

// Types
interface Thread {
  threadId: string;
  title: string;
  pinned: boolean;
  _creationTime: number;
  lastMessageAt: number;
  generationStatus: "pending" | "generation" | "compleated" | "failed";
}

interface ThreadSidebarInteractiveProps {
  preloadedThreads?: Preloaded<typeof api.threads.getUserThreadsPaginatedSafe>;
}

// Constants
const GROUP_ORDER = [
  "Fijados",
  "Hoy",
  "Ayer",
  "Esta Semana",
  "Este Mes",
  "Anteriores",
] as const;
const MAX_TITLE_LENGTH = 18;
const BLUR_DELAY = 150;

export function ThreadSidebarInteractive({
  preloadedThreads,
}: ThreadSidebarInteractiveProps) {
  // Hooks
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isLoadingMoreScroll, setIsLoadingMoreScroll] = useState(false);

  // Extract initial data from preloaded prop for instant display
  const initialThreads: Thread[] =
    (preloadedThreads as { _valueJSON?: { page?: Thread[] } })?._valueJSON
      ?.page || [];
  const [stableThreads, setStableThreads] = useState<Thread[]>(initialThreads);

  // Convex queries and mutations
  const preloadedResults = usePreloadedQuery(preloadedThreads!);
  const fallbackResults = usePaginatedQuery(
    api.threads.getUserThreadsPaginatedSafe,
    { paginationOpts: { numItems: 20, cursor: null } },
    { initialNumItems: 20 },
  );

  const deleteThread = useMutation(api.threads.deleteThread);
  const renameThread = useMutation(api.threads.renameThread);
  const togglePinThread = useMutation(api.threads.togglePinThread);

  // Derived state
  const threads = stableThreads;
  const status =
    preloadedThreads && preloadedResults?.isDone
      ? "Exhausted"
      : !preloadedThreads
        ? fallbackResults.status
        : "CanLoadMore";
  
  // Check if we're currently loading (either manual or scroll)
  const isCurrentlyLoading = isLoadingMore || isLoadingMoreScroll;

  // Effects
  useEffect(() => {
    if (
      preloadedThreads &&
      preloadedResults?.page &&
      preloadedResults.page.length > 0
    ) {
      setStableThreads(preloadedResults.page);
    }
  }, [preloadedResults?.page, preloadedThreads]);

  useEffect(() => {
    if (
      !preloadedThreads &&
      fallbackResults.results &&
      fallbackResults.results.length > 0 &&
      stableThreads.length === 0
    ) {
      setStableThreads(fallbackResults.results);
    }
  }, [fallbackResults.results, preloadedThreads, stableThreads.length]);

  useEffect(() => {
    const searchInput = document.getElementById(
      "thread-search-input",
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.removeAttribute("readonly");
      searchInput.value = searchQuery;

      const handleInputChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        setSearchQuery(target.value);
      };

      searchInput.addEventListener("input", handleInputChange);
      return () => searchInput.removeEventListener("input", handleInputChange);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (editingThreadId && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [editingThreadId]);

  // Infinite scroll effect
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const threshold = 200; // Increased threshold to 200px
      
      // Only trigger if we're near the bottom and can load more
      if (
        scrollTop + clientHeight >= scrollHeight - threshold &&
        status === "CanLoadMore" &&
        !isCurrentlyLoading &&
        !searchQuery // Don't auto-load during search
      ) {
        setIsLoadingMoreScroll(true);
        try {
          fallbackResults.loadMore(10);
        } finally {
          // Use a longer delay to prevent rapid successive calls
          setTimeout(() => setIsLoadingMoreScroll(false), 1000);
        }
      }
    };

    // Add debounced scroll listener with longer debounce
    let timeoutId: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 200); // Increased debounce time
    };

    scrollContainer.addEventListener('scroll', debouncedHandleScroll);
    
    return () => {
      scrollContainer.removeEventListener('scroll', debouncedHandleScroll);
      clearTimeout(timeoutId);
    };
  }, [status, isCurrentlyLoading, searchQuery, fallbackResults]);

  // Helper functions
  const getTimeClassification = (timestamp: number): string => {
    const now = new Date();
    const threadDate = new Date(timestamp);
    const diffInMs = now.getTime() - threadDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Hoy";
    if (diffInDays === 1) return "Ayer";
    if (diffInDays <= 7) return "Esta Semana";
    if (diffInDays <= 30) return "Este Mes";
    return "Anteriores";
  };

  const filterAndGroupThreads = (threads: Thread[], searchQuery: string) => {
    const filtered = threads.filter((thread) =>
      thread.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return filtered.reduce(
      (groups, thread) => {
        const timeClass = getTimeClassification(thread.lastMessageAt);
        const groupKey = thread.pinned ? "Fijados" : timeClass;

        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(thread);
        return groups;
      },
      {} as Record<string, Thread[]>,
    );
  };

  // Event handlers
  const handleLoadMore = () => {
    if (status === "CanLoadMore") {
      setIsLoadingMore(true);
      try {
        fallbackResults.loadMore(10);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pathname === `/chat/${threadId}`) {
      router.replace("/");
    }
    try {
      await deleteThread({ threadId });
      toast.success("Hilo eliminado");
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Error al eliminar el hilo");
    }
  };

  const handleStartEdit = (
    threadId: string,
    currentTitle: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setEditingThreadId(threadId);
    setEditingTitle(currentTitle);
  };

  const handleSaveEdit = async (threadId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!editingTitle.trim()) {
      toast.error("El título no puede estar vacío");
      return;
    }

    const originalThread = threads.find((t) => t.threadId === threadId);
    const originalTitle = originalThread?.title || "";
    const newTitle = editingTitle.trim();

    if (originalTitle === newTitle) {
      setEditingThreadId(null);
      setEditingTitle("");
      return;
    }

    try {
      await renameThread({ threadId, title: newTitle });
      setEditingThreadId(null);
      setEditingTitle("");
      toast.success("Hilo renombrado");
    } catch (error) {
      console.error("Failed to rename thread:", error);
      toast.error("Error al renombrar el hilo");
    }
  };

  const handleCancelEdit = () => {
    setEditingThreadId(null);
    setEditingTitle("");
  };

  const handleTogglePin = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await togglePinThread({ threadId });
      toast.success("Estado de fijado actualizado");
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      toast.error("Error al actualizar el estado de fijado");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleSaveEdit(threadId, e as unknown as React.MouseEvent);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleCancelEdit();
    }
  };

  const handleInputBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest("button")) {
      setTimeout(() => {
        handleCancelEdit();
      }, BLUR_DELAY);
    }
  };

  // Render helpers
  const renderEmptyState = () => {
    if (filteredThreads.length === 0 && searchQuery) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          <p className="text-sm">
            No se encontraron chats que coincidan con &quot;{searchQuery}&quot;
          </p>
          <p className="text-xs">Intenta ajustar tus términos de búsqueda</p>
        </div>
      );
    }

    if (filteredThreads.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          <p className="text-sm">Aún no hay chats</p>
          <p className="text-xs">Inicia una nueva conversación</p>
        </div>
      );
    }

    return null;
  };

  const renderThreadItem = (thread: Thread) => {
    const isEditing = editingThreadId === thread.threadId;

    return (
      <ContextMenu key={thread.threadId}>
        <ContextMenuTrigger>
          <div
            onClick={() =>
              !isEditing && router.push(`/chat/${thread.threadId}`)
            }
            className={cn(
              "group relative flex items-center gap-2 p-2.5 mb-1 rounded-lg cursor-pointer transition-colors overflow-hidden",
              "hover:bg-hover hover:text-accent-foreground",
              pathname === `/chat/${thread.threadId}` &&
                "bg-hover text-accent-foreground",
              isEditing && "bg-hover text-accent-foreground",
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <div className="flex items-center gap-2 w-full h-5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, thread.threadId)}
                      onBlur={handleInputBlur}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-medium min-w-0 h-5 leading-5"
                      maxLength={MAX_TITLE_LENGTH}
                    />
                    <Button
                      onClick={(e) => handleSaveEdit(thread.threadId, e)}
                      onMouseDown={(e) => e.preventDefault()}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-green-500 hover:text-white flex-shrink-0"
                    >
                      <CheckIcon className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate h-5 leading-5 flex-1">
                      {thread.title}
                    </h3>
                    {(thread.generationStatus === "pending" ||
                      thread.generationStatus === "generation") && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-shrink-0">
                            <Loader
                              size={14}
                              className="text-muted-foreground hover:text-muted-foreground transition-colors"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          <p>
                            {thread.generationStatus === "pending"
                              ? "Preparando respuesta..."
                              : "Generando respuesta..."}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {thread.generationStatus === "failed" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-shrink-0">
                            <AlertTriangleIcon
                              size={14}
                              className="text-destructive/70 hover:text-destructive transition-colors"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          <p>Error al generar la respuesta</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
                {thread.pinned && (
                  <PinIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            className="hover:bg-hover"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleStartEdit(thread.threadId, thread.title, e);
            }}
          >
            <EditIcon className="h-3 w-3 mr-2" />
            Renombrar
          </ContextMenuItem>
          <ContextMenuItem
            className="hover:bg-hover"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleTogglePin(thread.threadId, e);
            }}
          >
            <PinIcon className="h-3 w-3 mr-2" />
            {thread.pinned ? "Desfijar" : "Fijar"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            className="hover:bg-hover"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleDeleteThread(thread.threadId, e);
            }}
          >
            <DeleteIcon className="h-3 w-3 mr-2" />
            Eliminar
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderThreadGroup = (groupName: string, groupThreads: Thread[]) => {
    if (!groupThreads || groupThreads.length === 0) return null;

    return (
      <div key={groupName} className="mb-4">
        <div className="px-5 py-2">
          <span className="text-xs font-semibold text-black/75 dark:text-popover-text/75">
            {groupName}
          </span>
        </div>
        <div className="space-y-0.5 px-5">
          {groupThreads.map(renderThreadItem)}
        </div>
      </div>
    );
  };

  // Main render
  const filteredThreads = threads.filter((thread) =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const groupedThreads = filterAndGroupThreads(threads, searchQuery);

  return (
    <>
      {renderEmptyState() || (
        <div 
          ref={scrollContainerRef}
          className="sidebar-scroll-container auto-hide-scrollbar w-full overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto"
        >
          {GROUP_ORDER.map((groupName) =>
            renderThreadGroup(groupName, groupedThreads[groupName]),
          )}
        </div>
      )}

      {/* Loading indicator positioned outside scroll container to prevent flickering */}
      {isLoadingMoreScroll && (
        <div className="p-2 text-center text-muted-foreground border-t border-border">
          <Loader size={14} className="mx-auto" />
          <p className="text-xs mt-1">Cargando más chats...</p>
        </div>
      )}

      {/* Fallback Load More button - only show if infinite scroll fails */}
      {status === "CanLoadMore" && !searchQuery && !isCurrentlyLoading && (
        <div className="p-4 border-t border-border">
          <Button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isLoadingMore ? "Cargando..." : "Cargar más"}
          </Button>
        </div>
      )}
    </>
  );
}
