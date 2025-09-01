"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ai/ui/button";
import { MessageSquareIcon, PinIcon, Trash2Icon, EditIcon, CheckIcon } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Authenticated, Unauthenticated } from "convex/react";

export function ThreadSidebarInteractive() {
  return (
    <>
      <Authenticated>
        <AuthenticatedContent />
      </Authenticated>
    </>
  );
}

function AuthenticatedContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Query for user threads with pagination
  const { results: threads = [], status, loadMore } = usePaginatedQuery(
    api.threads.getUserThreadsPaginated,
    { paginationOpts: { numItems: 20, cursor: null } },
    { initialNumItems: 20 }
  );

  // Filter threads based on search query
  const filteredThreads = threads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mutations
  const deleteThread = useMutation(api.threads.deleteThread);
  const renameThread = useMutation(api.threads.renameThread);

  // Hydrate the server-rendered search input with interactive functionality
  useEffect(() => {
    const searchInput = document.getElementById('thread-search-input') as HTMLInputElement;
    if (searchInput) {
      // Remove readOnly and add event handlers
      searchInput.removeAttribute('readonly');
      searchInput.value = searchQuery;
      
      const handleInputChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        setSearchQuery(target.value);
      };
      
      searchInput.addEventListener('input', handleInputChange);
      
      // Cleanup
      return () => {
        searchInput.removeEventListener('input', handleInputChange);
      };
    }
  }, [searchQuery]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingThreadId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingThreadId]);

  const handleLoadMore = async () => {
    if (status === "CanLoadMore") {
      setIsLoadingMore(true);
      try {
        await loadMore(10);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If we're currently viewing the thread to be deleted, redirect first
    if (pathname === `/chat/${threadId}`) {
      router.replace("/");
    }
    
    try {
      await deleteThread({ threadId });
      toast.success("Thread deleted");
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Failed to delete thread");
    }
  };

  const handleStartEdit = (threadId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(threadId);
    setEditingTitle(currentTitle);
  };

  const handleSaveEdit = async (threadId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!editingTitle.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    // Find the original thread title
    const originalThread = threads.find(t => t.threadId === threadId);
    const originalTitle = originalThread?.title || "";
    const newTitle = editingTitle.trim();

    // Only submit if the title actually changed
    if (originalTitle === newTitle) {
      setEditingThreadId(null);
      setEditingTitle("");
      return;
    }

    try {
      await renameThread({ threadId, title: newTitle });
      setEditingThreadId(null);
      setEditingTitle("");
      toast.success("Thread renamed");
    } catch (error) {
      console.error("Failed to rename thread:", error);
      toast.error("Failed to rename thread");
    }
  };

  const handleCancelEdit = () => {
    setEditingThreadId(null);
    setEditingTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleSaveEdit(threadId, e as any);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleCancelEdit();
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "generation":
        return "bg-blue-500";
      case "compleated":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <>
      {/* Thread List */}
      {filteredThreads.length === 0 && searchQuery ? (
        <div className="p-4 text-center text-muted-foreground">
          <p className="text-sm">
            No chats found matching "{searchQuery}"
          </p>
          <p className="text-xs">
            Try adjusting your search terms
          </p>
        </div>
      ) : filteredThreads.length > 0 && (
        <div className="space-y-1 p-2">
          {filteredThreads.map((thread) => {
            const isEditing = editingThreadId === thread.threadId;
            
            return (
              <div
                key={thread.threadId}
                onClick={() => !isEditing && router.push(`/chat/${thread.threadId}`)}
                className={cn(
                  "group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  pathname === `/chat/${thread.threadId}` && "bg-accent text-accent-foreground",
                  isEditing && "bg-accent text-accent-foreground"
                )}
              >
                {/* Status indicator */}
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  getStatusColor(thread.generationStatus)
                )} />
                
                {/* Thread info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, thread.threadId)}
                        onBlur={handleCancelEdit}
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
                        maxLength={18}
                      />
                    ) : (
                      <h3 className="text-sm font-medium truncate">
                        {thread.title}
                      </h3>
                    )}
                    {thread.pinned && (
                      <PinIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatDate(thread.lastMessageAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                     {isEditing ? (
                     <Button
                       onClick={(e) => handleSaveEdit(thread.threadId, e)}
                       onMouseDown={(e) => e.preventDefault()}
                       size="sm"
                       variant="ghost"
                       className="h-6 w-6 p-0 hover:bg-green-500 hover:text-white"
                     >
                       <CheckIcon className="h-3 w-3" />
                     </Button>
                   ) : (
                    <Button
                      onClick={(e) => handleStartEdit(thread.threadId, thread.title, e)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-blue-500 hover:text-white"
                    >
                      <EditIcon className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    onClick={(e) => handleDeleteThread(thread.threadId, e)}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2Icon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Button - only show if there are more results and no search filter */}
      {status === "CanLoadMore" && !searchQuery && (
        <div className="p-4 border-t border-border">
          <Button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isLoadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </>
  );
}
