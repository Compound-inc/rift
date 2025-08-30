"use client";

import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Pin, Pencil, Trash } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Authenticated, Unauthenticated } from "convex/react";
import { useChatCache } from "@/contexts/chat-cache";

type ThreadItem = {
  _id: string;
  threadId: string;
  title: string;
  updatedAt: number;
  pinned: boolean;
  model: string;
};

function Content() {
  const pathname = usePathname();
  const router = useRouter();
  const { prefetchThread } = useChatCache();
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<ThreadItem | null>(null);
  
  const renameThread = useMutation(api.threads.renameThread);
  const deleteThread = useMutation(api.threads.deleteThread);
  
  // Load threads with pagination (most recent first)
  const { results, status, loadMore } = usePaginatedQuery(
    api.threads.getUserThreadsPaginated,
    {},
    { initialNumItems: 20 },
  );

  // Auto-load more threads when scrolling near the bottom
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const scrollArea = scrollRef.current?.closest('[data-slot="scroll-area"]');
    if (!scrollArea) return;

    const handleScroll = () => {
      const viewport = scrollArea.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
      if (!viewport) return;

      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom && status === "CanLoadMore") {
        loadMore(20);
      }
    };

    const viewport = scrollArea.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) {
      viewport.addEventListener("scroll", handleScroll, { passive: true });
      return () => viewport.removeEventListener("scroll", handleScroll);
    }
  }, [status, loadMore]);

  const handleClick = useCallback(async (e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    // If currently editing this row, do not navigate
    if (editingThreadId === threadId) return;
    try {
      setLoadingThreadId(threadId);
      await prefetchThread(threadId, { numMessages: 20 });
      router.push(`/chat/${threadId}`);
    } catch {
      // Thread may not exist anymore; route to root to avoid errors
      router.push("/");
    } finally {
      setLoadingThreadId(null);
    }
  }, [prefetchThread, router, editingThreadId]);

  const beginEdit = useCallback((e: React.MouseEvent, thread: ThreadItem) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingThreadId(thread.threadId);
    setEditingTitle(thread.title);
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editingThreadId) return;
    const trimmed = editingTitle.trim();
    if (trimmed.length === 0) {
      // No empty title; just cancel
      setEditingThreadId(null);
      return;
    }
    await renameThread({ threadId: editingThreadId, title: trimmed });
    setEditingThreadId(null);
  }, [editingThreadId, editingTitle, renameThread]);

  const cancelEdit = useCallback(() => {
    setEditingThreadId(null);
  }, []);

  const openDeleteDialog = useCallback((e: React.MouseEvent, thread: ThreadItem) => {
    e.preventDefault();
    e.stopPropagation();
    setThreadToDelete(thread);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!threadToDelete) return;
    
    const isActive = pathname === `/chat/${threadToDelete.threadId}`;
    if (isActive) {
      // Navigate away first to prevent active chat page from querying a deleted thread
      router.push("/");
      // Defer deletion to the next tick to let the route transition unmount the page
      setTimeout(() => {
        void deleteThread({ threadId: threadToDelete.threadId });
      }, 0);
    } else {
      await deleteThread({ threadId: threadToDelete.threadId });
    }
    
    setDeleteDialogOpen(false);
    setThreadToDelete(null);
  }, [threadToDelete, pathname, router, deleteThread]);

  const cancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setThreadToDelete(null);
  }, []);

  // Show loading state until we have results or know there are no results
  if (status === "LoadingFirstPage" || results === undefined) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground"></div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No chats yet</p>
        <p className="text-xs text-muted-foreground">Start a conversation to see it here</p>
      </div>
    );
  }

  const getTimeCategory = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) return "Hoy";
    if (diffInHours < 168) return "Última semana";
    if (diffInHours < 720) return "Último mes";
    return "Antes";
  };

  // Group threads by time category
  const groupedThreads = results.reduce((groups, thread) => {
    const category = getTimeCategory(thread.updatedAt);
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(thread);
    return groups;
  }, {} as Record<string, ThreadItem[]>);

  // Define the order of categories
  const categoryOrder = ["Hoy", "Última semana", "Último mes", "Antes"];

  return (
    <>
      <ScrollArea ref={scrollRef} className="h-full">
        <div className="space-y-1 p-2">
          {categoryOrder.map((category) => {
            const threads = groupedThreads[category];
            if (!threads || threads.length === 0) return null;
            
            return (
              <div key={category}>
                <div className="px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 tracking-wide">
                  {category}
                </div>
                {threads.map((thread: ThreadItem) => {
                  const isActive = pathname === `/chat/${thread.threadId}`;
                  const isLoading = loadingThreadId === thread.threadId;
                  const isEditing = editingThreadId === thread.threadId;
                  
                  return (
                    <Link
                      key={thread.threadId}
                      href={`/chat/${thread.threadId}`}
                      prefetch={false}
                      onClick={(e) => void handleClick(e, thread.threadId)}
                      className={`group/thread relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                      } ${isLoading ? "opacity-70" : ""}`}
                      aria-busy={isLoading}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {thread.pinned && (
                            <Pin className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                          )}
                          {isEditing ? (
                            <input
                              className="w-full bg-transparent outline-none border-b border-transparent focus:border-border text-foreground font-medium"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              autoFocus
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void commitEdit();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelEdit();
                                }
                              }}
                              onBlur={() => void commitEdit()}
                            />
                          ) : (
                            <span className="truncate font-medium">
                              {thread.title}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/thread:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label="Edit"
                          onClick={(e) => beginEdit(e, thread)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label="Delete"
                          onClick={(e) => openDeleteDialog(e, thread)}
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
          
          {status === "CanLoadMore" && (
            <div className="flex justify-center p-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadMore(20)}
                className="w-full"
              >
                Load More
              </Button>
            </div>
          )}
          
          {status === "LoadingMore" && (
            <div className="flex justify-center p-2">
              <div className="text-sm text-muted-foreground"></div>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Thread</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{threadToDelete?.title}"? This action cannot be undone and will permanently remove all messages in this thread.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Thread
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SidebarHistory() {
  return (
    <>
      <Authenticated>
        <Content />
      </Authenticated>
      <Unauthenticated>
        {null}
      </Unauthenticated>
    </>
  );
}
