"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Preloaded, usePaginatedQuery, usePreloadedQuery, useMutation, useConvexAuth, Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ai/ui/button";
import { Loader } from "@/components/ai/loader";
import { toast } from "sonner";
import { cn, copyToClipboard } from "@/lib/utils";
import { useChatSidebarControls } from "@/components/ai/ChatShellClient";
import { logThreadRemoved, logThreadRenamed } from "@/actions/audit";
import { CheckIcon, AlertTriangleIcon } from "lucide-react";
import { EditIcon, DeleteIcon, PinIcon, ShareIcon } from "@/components/ui/icons/svg-icons";
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
import { useThreadShare } from "@/lib/hooks/useThreadShare";
import { ShareSettingsDialog } from "@/components/share/ShareSettingsDialog";

interface Thread {
  threadId: string;
  title: string;
  pinned: boolean;
  _creationTime: number;
  lastMessageAt: number;
  generationStatus:
    | "pending"
    | "generation"
    | "compleated" // legacy, remove after migration
    | "completed"
    | "failed";
  updatedAt?: number;
  shareId?: string;
  shareStatus?: "active" | "revoked";
  sharedAt?: number;
}

interface ThreadSidebarInteractiveProps {
  preloadedThreads?: Preloaded<typeof api.threads.getUserThreadsPaginatedSafe>;
}

const PAGE_SIZE = 20;
const GROUP_ORDER = [
  "Fijados",
  "Hoy",
  "Ayer",
  "Esta Semana",
  "Este Mes",
  "Anteriores",
] as const;
const MAX_TITLE_LENGTH = 35;
const BLUR_DELAY = 150;

const parsePreloadedSnapshot = (
  preloadedThreads?: Preloaded<typeof api.threads.getUserThreadsPaginatedSafe>,
) => {
  const snapshot = (preloadedThreads as {
    _valueJSON?: {
      page?: Thread[];
      continueCursor?: string;
      isDone?: boolean;
    };
  })?._valueJSON;

  return {
    page: snapshot?.page ?? [],
    continueCursor: snapshot?.continueCursor ?? null,
    isDone: snapshot?.isDone ?? true,
  };
};

const sortThreads = (a: Thread, b: Thread) => {
  if (a.pinned && !b.pinned) return -1;
  if (!a.pinned && b.pinned) return 1;

  const aTime = a.lastMessageAt ?? a.updatedAt ?? a._creationTime;
  const bTime = b.lastMessageAt ?? b.updatedAt ?? b._creationTime;

  return bTime - aTime;
};

export function ThreadSidebarInteractive({
  preloadedThreads,
}: ThreadSidebarInteractiveProps) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { closeSidebar, isMobile: isMobileViewport } = useChatSidebarControls();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [loadingSource, setLoadingSource] = useState<null | "scroll">(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [shareDialogThread, setShareDialogThread] = useState<Thread | null>(null);
  const requestInFlightRef = useRef(false);
  const [optimisticTitles, setOptimisticTitles] = useState<Record<string, string>>({});
  const {
    resolveShareState,
    handleToggleShare,
    handleCopyShareLink,
    handleUpdateShareSettings,
    handleRegenerateShareLink,
  } = useThreadShare();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const preloadedSnapshot = useMemo(
    () => parsePreloadedSnapshot(preloadedThreads),
    [preloadedThreads],
  );

  // Always call the hook when preloaded exists
  const preloadedResults = preloadedThreads
    ? usePreloadedQuery(preloadedThreads)
    : null;

  const preloadedIsDone = preloadedResults?.isDone ?? preloadedSnapshot.isDone;
  const hasPreloadedMore = Boolean(preloadedThreads && !preloadedIsDone);
  // Avoid running live paginated query until auth is confirmed
  const shouldUsePaginated = hasHydrated && isAuthenticated && (!preloadedThreads || hasPreloadedMore);

  const paginatedArgs = useMemo(
    () => ({
      paginationOpts: {
        numItems: PAGE_SIZE,
        cursor: hasPreloadedMore ? preloadedSnapshot.continueCursor : null,
      },
    }),
    [hasPreloadedMore, preloadedSnapshot.continueCursor],
  );

  const paginatedOptions = useMemo(
    () => ({ initialNumItems: hasPreloadedMore ? 0 : PAGE_SIZE }),
    [hasPreloadedMore],
  );

  const paginated = usePaginatedQuery(
    api.threads.getUserThreadsPaginatedSafe,
    shouldUsePaginated ? paginatedArgs : "skip",
    paginatedOptions,
  );

  const paginatedResults = (paginated?.results ?? []) as Thread[];
  const paginatedStatus = shouldUsePaginated
    ? paginated?.status ?? "LoadingFirstPage"
    : "Exhausted";
  const loadMore = paginated?.loadMore;

  useEffect(() => {
    if (editingThreadId && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editingThreadId]);

  useEffect(() => {
    const searchInput = document.getElementById(
      "thread-search-input",
    ) as HTMLInputElement | null;

    if (!searchInput) {
      return;
    }

    searchInput.removeAttribute("readonly");
    searchInput.value = searchQuery;

    const handleInputChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      setSearchQuery(target.value);
    };

    searchInput.addEventListener("input", handleInputChange);
    return () => searchInput.removeEventListener("input", handleInputChange);
  }, [searchQuery]);

  const combinedThreads = useMemo(() => {
    // Freeze to SSR snapshot while auth is loading or unauthenticated
    const pageFromPreload = (isAuthenticated ? preloadedResults?.page : undefined) ?? preloadedSnapshot.page;
    const allThreads = hasPreloadedMore
      ? [...pageFromPreload, ...paginatedResults]
      : paginatedResults.length > 0
        ? paginatedResults
        : pageFromPreload;

    const threadsById = new Map<string, Thread>();
    for (const thread of allThreads) {
      threadsById.set(thread.threadId, thread);
    }

    return Array.from(threadsById.values()).sort(sortThreads);
  }, [hasPreloadedMore, paginatedResults, preloadedResults?.page, preloadedSnapshot.page, isAuthenticated]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery) {
      return combinedThreads;
    }

    const lowered = searchQuery.toLowerCase();
    return combinedThreads.filter((thread) =>
      thread.title.toLowerCase().includes(lowered),
    );
  }, [combinedThreads, searchQuery]);

  const groupedThreads = useMemo(() => {
    return filteredThreads.reduce((groups, thread) => {
      const now = new Date();
      const threadDate = new Date(thread.lastMessageAt);
      const diffInMs = now.getTime() - threadDate.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      let groupKey: (typeof GROUP_ORDER)[number] | string = "Anteriores";

      if (thread.pinned) {
        groupKey = "Fijados";
      } else if (diffInDays === 0) {
        groupKey = "Hoy";
      } else if (diffInDays === 1) {
        groupKey = "Ayer";
      } else if (diffInDays <= 7) {
        groupKey = "Esta Semana";
      } else if (diffInDays <= 30) {
        groupKey = "Este Mes";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }

      groups[groupKey]!.push(thread);
      return groups;
    }, {} as Record<string, Thread[]>);
  }, [filteredThreads]);

  const deleteThread = useMutation(api.threads.deleteThread);
  const renameThread = useMutation(api.threads.renameThread);
  const togglePinThread = useMutation(api.threads.togglePinThread);

  const canLoadMore = shouldUsePaginated && paginatedStatus === "CanLoadMore" && !searchQuery;
  const isLoadingMore = loadingSource !== null;
  const isScrollLoading = loadingSource === "scroll";

  const triggerLoadMore = useCallback(
    async (source: "scroll") => {
      if (!loadMore || !canLoadMore || isLoadingMore || requestInFlightRef.current) {
        return;
      }

      setLoadingSource(source);
      try {
        requestInFlightRef.current = true;
        await loadMore(PAGE_SIZE);
      } finally {
        requestInFlightRef.current = false;
        setLoadingSource(null);
      }
    },
    [canLoadMore, isLoadingMore, loadMore],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    const sentinel = sentinelRef.current;

    if (!container || !sentinel || !shouldUsePaginated) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            triggerLoadMore("scroll");
          }
        }
      },
      {
        root: container,
        rootMargin: "200px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [shouldUsePaginated, triggerLoadMore]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || searchQuery || !canLoadMore || isLoadingMore) {
      return;
    }

    if (container.scrollHeight <= container.clientHeight + 32) {
      triggerLoadMore("scroll");
    }
  }, [canLoadMore, combinedThreads.length, isLoadingMore, searchQuery, triggerLoadMore]);

  const handleDeleteThread = async (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (pathname === `/chat/${threadId}`) {
      router.replace("/");
    }

    try {
      // Capture title before deletion for audit log target name
      const thread = combinedThreads.find((t) => t.threadId === threadId);
      await deleteThread({ threadId });
      await logThreadRemoved(String(threadId), thread?.title);
      toast.success("Hilo eliminado");
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Error al eliminar el hilo");
    }
  };

  const handleStartEdit = (
    threadId: string,
    currentTitle: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    setEditingThreadId(threadId);
    setEditingTitle(currentTitle);
  };

  const handleSaveEdit = async (threadId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle) {
      toast.error("El título no puede estar vacío");
      return;
    }

    const originalThread = combinedThreads.find((thread) => thread.threadId === threadId);
    if (!originalThread) {
      return;
    }

    if (originalThread.title === trimmedTitle) {
      setEditingThreadId(null);
      setEditingTitle("");
      return;
    }

    // Optimistically update local title and exit editing
    setOptimisticTitles(prev => ({ ...prev, [threadId]: trimmedTitle }));
    setEditingThreadId(null);
    setEditingTitle("");

    try {
      await renameThread({ threadId, title: trimmedTitle });
      await logThreadRenamed(threadId, trimmedTitle, originalThread.title);
      // Clear optimistic after success
      setOptimisticTitles(prev => {
        const newTitles = { ...prev };
        delete newTitles[threadId];
        return newTitles;
      });
      toast.success("Hilo renombrado");
    } catch (error) {
      console.error("Failed to rename thread:", error);
      // Revert optimistic and return to editing with original
      setOptimisticTitles(prev => {
        const newTitles = { ...prev };
        delete newTitles[threadId];
        return newTitles;
      });
      setEditingThreadId(threadId);
      setEditingTitle(originalThread.title);
      toast.error("Error al renombrar el hilo");
    }
  };

  const handleCancelEdit = () => {
    setEditingThreadId(null);
    setEditingTitle("");
  };

  const handleTogglePin = async (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await togglePinThread({ threadId });
      toast.success("Estado de fijado actualizado");
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      toast.error("Error al actualizar el estado de fijado");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, threadId: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      handleSaveEdit(threadId, event as unknown as React.MouseEvent);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleCancelEdit();
    }
  };

  const handleInputBlur = (event: React.FocusEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !relatedTarget.closest("button")) {
      setTimeout(() => handleCancelEdit(), BLUR_DELAY);
    }
  };

  const handleContainerClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleThreadNavigation = useCallback(
    (threadId: string) => {
      router.push(`/chat/${threadId}`);
      if (isMobileViewport) {
        closeSidebar();
      }
    },
    [router, closeSidebar, isMobileViewport],
  );


  const renderThreadItem = (thread: Thread) => {
    const isEditing = editingThreadId === thread.threadId;
    const shareState = resolveShareState(thread);

    return (
      <ContextMenu key={thread.threadId}>
        <ContextMenuTrigger>
          <div
            onClick={isEditing ? handleContainerClick : () => handleThreadNavigation(thread.threadId)}
            className={cn(
              "group relative mb-1 flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg p-2.5 transition-colors",
              "hover:bg-hover hover:text-accent-foreground",
              pathname === `/chat/${thread.threadId}` &&
                "bg-hover text-accent-foreground",
              isEditing && "bg-hover text-accent-foreground",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <div className="flex h-5 w-full items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, thread.threadId)}
                      onBlur={handleInputBlur}
                      className="h-5 min-w-0 flex-1 border-none bg-transparent text-sm font-medium leading-5 outline-none"
                      maxLength={MAX_TITLE_LENGTH}
                    />
                    <Button
                      onClick={(event) => handleSaveEdit(thread.threadId, event)}
                      onMouseDown={(event) => event.preventDefault()}
                      size="sm"
                      variant="ghost"
                      className="flex-shrink-0 h-6 w-6 p-0 hover:bg-green-500 hover:text-white"
                    >
                      <CheckIcon className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <h3 className="flex-1 truncate text-sm font-medium leading-5">
                      {optimisticTitles[thread.threadId] || thread.title}
                    </h3>
                    {/* Always reserve space for status icons to prevent layout shift */}
                    <div className="flex-shrink-0 w-[14px] h-[14px] flex items-center justify-center">
                      {(thread.generationStatus === "pending" ||
                        thread.generationStatus === "generation") && (
                        <Tooltip>
                          <TooltipTrigger className="flex items-center justify-center w-full h-full">
                            <Loader
                              size={14}
                              className="text-muted-foreground transition-colors hover:text-muted-foreground"
                            />
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
                          <TooltipTrigger className="flex items-center justify-center w-full h-full">
                            <AlertTriangleIcon
                              size={14}
                              className="text-destructive/70 transition-colors hover:text-destructive"
                            />
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8}>
                            <p>Error al generar la respuesta</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                )}
                {!isEditing && thread.pinned && (
                  <PinIcon className="flex-shrink-0 h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="border border-zinc-200 bg-white shadow-md dark:border-zinc-800/70 dark:bg-zinc-950 dark:shadow-2xl">
          <ContextMenuItem
            className="hover:bg-hover"
            onClick={(event: React.MouseEvent) =>
              handleStartEdit(thread.threadId, thread.title, event)
            }
          >
            <EditIcon className="mr-2 h-3 w-3" />
            Renombrar
          </ContextMenuItem>
          <ContextMenuItem
            className="hover:bg-hover"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              setShareDialogThread(thread);
            }}
          >
            <ShareIcon className="mr-2 h-3 w-3" />
            {shareState.isShared ? "Opciones de compartir" : "Compartir chat"}
          </ContextMenuItem>
          <ContextMenuItem
            className="hover:bg-hover"
            onClick={(event: React.MouseEvent) =>
              handleTogglePin(thread.threadId, event)
            }
          >
            <PinIcon className="mr-2 h-3 w-3" />
            {thread.pinned ? "Desanclar" : "Fijar"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            className="hover:bg-hover"
            onClick={(event: React.MouseEvent) =>
              handleDeleteThread(thread.threadId, event)
            }
          >
            <DeleteIcon className="mr-2 h-3 w-3" />
            Eliminar
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderThreadGroup = (
    groupName: (typeof GROUP_ORDER)[number],
    groupThreads: Thread[] | undefined,
  ) => {
    if (!groupThreads || groupThreads.length === 0) {
      return null;
    }

    return (
      <div key={groupName} className="mb-4">
        <div className="px-5 py-2">
          <span className="text-xs font-semibold text-black/75 dark:text-popover-text/75">
            {groupName}
          </span>
        </div>
        <div className="space-y-0.5 px-3">{groupThreads.map(renderThreadItem)}</div>
      </div>
    );
  };

  const renderEmptyState = () => {
    // During auth loading, show nothing changing to avoid flicker from empty safe query
    if (authLoading) {
      return null;
    }
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0">
        <AuthLoading>
          {/* Keep layout stable while auth loads; render snapshot groups when present */}
          {preloadedSnapshot.page.length > 0 ? (
            <div
              ref={scrollContainerRef}
              className="sidebar-scroll-container h-full w-full overflow-y-auto"
            >
              {GROUP_ORDER.map((groupName) =>
                renderThreadGroup(groupName, groupedThreads[groupName]),
              )}
              <div ref={sentinelRef} className="h-[1px] w-full" />
            </div>
          ) : null}
        </AuthLoading>
        <Authenticated>
          {renderEmptyState() || (
            <div
              ref={scrollContainerRef}
              className="sidebar-scroll-container h-full w-full overflow-y-auto"
            >
              {GROUP_ORDER.map((groupName) =>
                renderThreadGroup(groupName, groupedThreads[groupName]),
              )}
              <div ref={sentinelRef} className="h-[1px] w-full" />
            </div>
          )}
        </Authenticated>
        <Unauthenticated>
          {/* If unauthenticated, show snapshot if any; otherwise show empty-state copy */}
          {preloadedSnapshot.page.length > 0 ? (
            <div
              ref={scrollContainerRef}
              className="sidebar-scroll-container h-full w-full overflow-y-auto"
            >
              {GROUP_ORDER.map((groupName) =>
                renderThreadGroup(groupName, groupedThreads[groupName]),
              )}
              <div ref={sentinelRef} className="h-[1px] w-full" />
            </div>
          ) : (
            renderEmptyState()
          )}
        </Unauthenticated>
      </div>

      {isScrollLoading && (
        <div className="border-t border-border p-2 text-center text-muted-foreground">
          <Loader size={14} className="mx-auto" />
          <p className="mt-1 text-xs">Cargando más chats...</p>
        </div>
      )}

      {/* Button removed: automatic infinite scroll handles pagination */}

      <ShareSettingsDialog
        thread={
          shareDialogThread
            ? {
                threadId: shareDialogThread.threadId,
                title: shareDialogThread.title,
                shareId: shareDialogThread.shareId,
                shareStatus: shareDialogThread.shareStatus,
              }
            : null
        }
        shareState={shareDialogThread ? resolveShareState(shareDialogThread) : null}
        onClose={() => setShareDialogThread(null)}
        handleToggleShare={handleToggleShare}
        handleCopyShareLink={handleCopyShareLink}
        updateShareSettings={handleUpdateShareSettings}
        regenerateShareLink={handleRegenerateShareLink}
      />
    </div>
  );
}

