"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useLocale } from "@/contexts/locale-context";
import {
  usePaginatedQuery,
  useMutation,
  useConvexAuth,
  Authenticated,
  AuthLoading,
  Unauthenticated,
} from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@rift/ui/button";
import { Loader } from "@/components/chat/loader";
import { toast } from "sonner";
import { cn, copyToClipboard } from "@rift/utils";
import { useChatSidebarControls } from "@/components/chat/ChatShellClient";
import { logThreadRemoved, logThreadRenamed } from "@/actions/audit";
import { AlertTriangleIcon } from "lucide-react";
import { EditIcon, DeleteIcon, PinIcon, ShareIcon } from "@/components/ui/icons/svg-icons";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@rift/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@rift/ui/context-menu";
import { useThreadShare } from "@/hooks/useThreadShare";
import { ShareSettingsModal } from "@/components/share/ShareSettingsModal";
import { prefetchCachedThreadMessages } from "@/lib/local-first/thread-messages-cache";
import { useSelectedThreadStore } from "@/store/selected-thread-store";
import { useModel } from "@/contexts/model-context";

interface Thread {
  threadId: string;
  title: string;
  pinned: boolean;
  _creationTime: number;
  lastMessageAt: number;
  generationStatus:
    | "pending"
    | "generation"
    | "completed"
    | "failed";
  updatedAt?: number;
  shareId?: string;
  shareStatus?: "active" | "revoked";
  sharedAt?: number;
  model?: string;
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

const sortThreads = (a: Thread, b: Thread) => {
  if (a.pinned && !b.pinned) return -1;
  if (!a.pinned && b.pinned) return 1;

  const aTime = a.lastMessageAt ?? a.updatedAt ?? a._creationTime;
  const bTime = b.lastMessageAt ?? b.updatedAt ?? b._creationTime;

  return bTime - aTime;
};

export function ThreadSidebarInteractive({
}: {}) {
  const lang = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { closeSidebar, isMobile: isMobileViewport } = useChatSidebarControls();
  const selectedThreadId = useSelectedThreadStore((s) => s.selectedThreadId);
  const setSelectedThreadId = useSelectedThreadStore((s) => s.setSelectedThreadId);
  const { setSelectedModel } = useModel();
  const setSelectedModelRef = useRef(setSelectedModel);
  setSelectedModelRef.current = setSelectedModel;
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [loadingSource, setLoadingSource] = useState<null | "scroll">(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [shareModalThread, setShareModalThread] = useState<Thread | null>(null);
  const requestInFlightRef = useRef(false);
  const [optimisticTitles, setOptimisticTitles] = useState<Record<string, string>>({});
  const prefetchedThreadIdsRef = useRef<Set<string>>(new Set());
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

  const handleCancelEdit = useCallback(() => {
    setEditingThreadId(null);
    setEditingTitle("");
  }, []);

  useEffect(() => {
    if (!editingThreadId) {
      return;
    }

    const input = inputRef.current;
    if (input) {
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!input) {
        return;
      }

      const target = event.target as Node | null;
      if (!target) {
        handleCancelEdit();
        return;
      }

      // Don't cancel if clicking on the input or its container
      if (input === target || input.contains(target) || input.parentElement?.contains(target)) {
        return;
      }

      // Don't cancel if clicking on context menu or other UI overlays
      const element = target as Element;
      if (
        element.closest('[data-slot="context-menu-content"]') ||
        element.closest('[role="dialog"]') ||
        element.closest('[data-radix-portal]')
      ) {
        return;
      }

      handleCancelEdit();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [editingThreadId, handleCancelEdit]);

  const shouldUsePaginated = hasHydrated && isAuthenticated && !authLoading;
  const paginatedArgs = useMemo(
    () => ({
      paginationOpts: {
        numItems: PAGE_SIZE,
        cursor: null,
      },
    }),
    [],
  );

  const paginated = usePaginatedQuery(
    api.threads.getUserThreadsPaginatedSafe,
    shouldUsePaginated ? paginatedArgs : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  const paginatedResults = useMemo(
    () => (paginated?.results ?? []) as Thread[],
    [paginated?.results],
  );

  const baseThreads: Thread[] = useMemo(
    () => paginatedResults ?? [],
    [paginatedResults],
  );
  const paginatedStatus = shouldUsePaginated
    ? paginated?.status ?? "LoadingFirstPage"
    : "Exhausted";
  const loadMore = paginated?.loadMore;


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
    return [...baseThreads].sort(sortThreads);
  }, [baseThreads]);

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

    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
    }

    try {
      // Capture title before deletion for audit log target name
      const thread = combinedThreads.find((t) => t.threadId === threadId);
      await deleteThread({ threadId });
      await logThreadRemoved(String(threadId), thread?.title);
      toast.success("Conversación eliminada");
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Error al eliminar la conversación");
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

  const handleSaveEdit = async (threadId: string) => {
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
      toast.success("Conversación renombrada");
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
      toast.error("Error al renombrar la conversación");
    }
  };

  const handleTogglePin = async (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await togglePinThread({ threadId });
      toast.success("Conversación fijada/desfijada");
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      toast.error("Error al fijar/desfijar la conversación");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, threadId: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      handleSaveEdit(threadId);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleCancelEdit();
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
    (threadId: string, model?: string) => {
      // Restore active model to this thread's model when navigating (click path).
      if (model) {
        setSelectedModel(model);
      }
      prefetchCachedThreadMessages(threadId);
      setSelectedThreadId(threadId);
      if (isMobileViewport) {
        closeSidebar();
      }
    },
    [closeSidebar, isMobileViewport, setSelectedThreadId, setSelectedModel],
  );

  const handleThreadLinkClick = useCallback(
    (thread: Thread, event: React.MouseEvent<HTMLAnchorElement>) => {
      if (editingThreadId === thread.threadId) {
        event.preventDefault();
        handleContainerClick(event as unknown as React.MouseEvent);
        return;
      }
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      handleThreadNavigation(thread.threadId, thread.model);
    },
    [editingThreadId, handleThreadNavigation, handleContainerClick],
  );

  // Sync active model only when user navigates to a different thread (not when thread list refetches).
  const previousSelectedThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedThreadId) {
      previousSelectedThreadIdRef.current = null;
      return;
    }
    const didNavigate = previousSelectedThreadIdRef.current !== selectedThreadId;
    previousSelectedThreadIdRef.current = selectedThreadId;
    if (!didNavigate) return;
    const thread = combinedThreads.find((t) => t.threadId === selectedThreadId);
    if (thread?.model) {
      setSelectedModelRef.current(thread.model);
    }
  }, [selectedThreadId, combinedThreads]);

  // Idle prefetch: warm local-first cache (IndexedDB -> memory).
  useEffect(() => {
    if (!hasHydrated || authLoading) return;

    const ids: string[] = [];
    for (const groupName of GROUP_ORDER) {
      const group = groupedThreads[groupName];
      if (!group) continue;
      for (const t of group) {
        if (t.threadId && selectedThreadId !== t.threadId) {
          ids.push(t.threadId);
        }
      }
    }

    const toPrefetch = ids.slice(0, 12);
    if (toPrefetch.length === 0) return;

    const run = () => {
      for (const threadId of toPrefetch) {
        if (prefetchedThreadIdsRef.current.has(threadId)) continue;
        prefetchedThreadIdsRef.current.add(threadId);
        prefetchCachedThreadMessages(threadId);
      }
    };

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout?: number }) => number)
      | undefined;
    const cic = (window as any).cancelIdleCallback as
      | ((id: number) => void)
      | undefined;

    if (typeof ric === "function") {
      const id = ric(run, { timeout: 1500 });
      return () => {
        if (typeof cic === "function") cic(id);
      };
    }

    const timeout = window.setTimeout(run, 0);
    return () => window.clearTimeout(timeout);
  }, [groupedThreads, hasHydrated, authLoading, selectedThreadId]);


  const renderThreadItem = (thread: Thread) => {
    const isEditing = editingThreadId === thread.threadId;
    const shareState = resolveShareState(thread);

    return (
      <ContextMenu key={thread.threadId}>
        <ContextMenuTrigger>
          <a
            href={`/${lang}/chat/${thread.threadId}`}
            onClick={(event) => handleThreadLinkClick(thread, event)}
            onPointerEnter={() => {
              // Warm both the route and local-first cache on hover (mouse/pen).
              if (!prefetchedThreadIdsRef.current.has(thread.threadId)) {
                prefetchedThreadIdsRef.current.add(thread.threadId);
                prefetchCachedThreadMessages(thread.threadId);
              }
            }}
            onPointerDown={() => {
              // Touch/mobile doesn't hover; start warming as early as possible.
              if (!prefetchedThreadIdsRef.current.has(thread.threadId)) {
                prefetchedThreadIdsRef.current.add(thread.threadId);
                prefetchCachedThreadMessages(thread.threadId);
              }
            }}
            className={cn(
              "group relative mb-1 flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg p-2.25",
              "transition-colors duration-10 ease-out",
              "will-change-[background-color]",
              "hover:bg-hover hover:text-accent-foreground",
              selectedThreadId === thread.threadId &&
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
                      autoFocus
                      className="h-5 min-w-0 flex-1 border-none bg-transparent text-sm font-medium leading-5 outline-none"
                      maxLength={MAX_TITLE_LENGTH}
                    />
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <h3 className="flex-1 truncate text-sm font-light leading-5 subpixel-antialiased text-foreground/75 dark:text-foreground/90">
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
          </a>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="border border-zinc-200 bg-white shadow-md dark:border-zinc-800/70 dark:bg-zinc-950 dark:shadow-2xl"
          onCloseAutoFocus={(event) => {
            if (editingThreadId !== thread.threadId) {
              return;
            }
            event.preventDefault();
            requestAnimationFrame(() => {
              const input = inputRef.current;
              if (input) {
                input.focus();
                input.select();
              }
            });
          }}
        >
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
              setShareModalThread(thread);
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
        <div className="px-5 py-1">
          <span className="text-xs font-semibold text-black/75 dark:text-popover-text tracking-wide">
            {groupName}
          </span>
        </div>
        <div className="space-y-0.5 pl-5 pr-3">{groupThreads.map(renderThreadItem)}</div>
      </div>
    );
  };

  const renderEmptyState = () => {
    // Keep sidebar body blank until we have client auth + data to avoid layout shifts.
    if (authLoading || !hasHydrated) return null;
    
    // If there are threads to show, don't render empty state
    if (filteredThreads.length > 0) return null;
    
    if (searchQuery) {
      return (
        <div className="flex h-full items-center justify-center px-5">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              No se encontraron chats que coincidan con &quot;{searchQuery}&quot;
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex h-full items-center justify-center px-5">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Aún no hay chats</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0">
        <AuthLoading>{null}</AuthLoading>
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
        <Unauthenticated>{renderEmptyState()}</Unauthenticated>
      </div>

      {/* Button removed: automatic infinite scroll handles pagination */}

      <ShareSettingsModal
        thread={
          shareModalThread
            ? {
                threadId: shareModalThread.threadId,
                title: shareModalThread.title,
                shareId: shareModalThread.shareId,
                shareStatus: shareModalThread.shareStatus,
              }
            : null
        }
        shareState={shareModalThread ? resolveShareState(shareModalThread) : null}
        onClose={() => setShareModalThread(null)}
        handleToggleShare={handleToggleShare}
        handleCopyShareLink={handleCopyShareLink}
        updateShareSettings={handleUpdateShareSettings}
        regenerateShareLink={handleRegenerateShareLink}
      />
    </div>
  );
}

