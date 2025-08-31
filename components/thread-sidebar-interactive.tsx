"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ai/ui/button";
import { MessageSquareIcon, PinIcon, Trash2Icon } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
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
    try {
      await deleteThread({ threadId });
      toast.success("Thread deleted");
      // If we're currently viewing the deleted thread, redirect to home
      if (pathname === `/chat/${threadId}`) {
        router.push("/");
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Failed to delete thread");
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
          {filteredThreads.map((thread) => (
            <div
              key={thread.threadId}
              onClick={() => router.push(`/chat/${thread.threadId}`)}
              className={cn(
                "group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                pathname === `/chat/${thread.threadId}` && "bg-accent text-accent-foreground"
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
                  <h3 className="text-sm font-medium truncate">
                    {thread.title}
                  </h3>
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
          ))}
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
