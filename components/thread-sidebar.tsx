"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ai/ui/button";
import { PlusIcon, MessageSquareIcon, PinIcon, ArchiveIcon, Trash2Icon } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useModel } from "@/contexts/model-context";
import { generateUUID } from "@/lib/utils";
import { Authenticated, Unauthenticated } from "convex/react";

export default function ThreadSidebar() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="h-full w-full bg-background border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Chats</h2>
          <Authenticated>
            <CreateThreadButton />
          </Authenticated>
        </div>
        
        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        
        {/* Keyboard shortcut tip */}
        <div className="mt-2 text-xs text-muted-foreground text-center">
          💡 Press ⌘+B to toggle sidebar
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        <Authenticated>
          <AuthenticatedThreadList searchQuery={searchQuery} />
        </Authenticated>
        <Unauthenticated>
          <div className="p-4 text-center text-muted-foreground">
            <MessageSquareIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Please sign in to view your chats</p>
          </div>
        </Unauthenticated>
      </div>
    </div>
  );
}

function CreateThreadButton() {
  const router = useRouter();
  const { selectedModel } = useModel();
  const createThread = useMutation(api.threads.createThread);

  const handleCreateNewThread = async () => {
    try {
      const newThreadId = generateUUID();
      await createThread({
        threadId: newThreadId,
        model: selectedModel,
      });
      router.push(`/chat/${newThreadId}`);
    } catch (error) {
      console.error("Failed to create thread:", error);
      toast.error("Failed to create new thread");
    }
  };

  return (
    <Button
      onClick={handleCreateNewThread}
      size="sm"
      variant="outline"
      className="h-8 w-8 p-0"
    >
      <PlusIcon className="h-4 w-4" />
    </Button>
  );
}

function AuthenticatedThreadList({ searchQuery }: { searchQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { selectedModel } = useModel();
  
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
  const createThread = useMutation(api.threads.createThread);

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

  const handleCreateNewThread = async () => {
    try {
      const newThreadId = generateUUID();
      await createThread({
        threadId: newThreadId,
        model: selectedModel,
      });
      router.push(`/chat/${newThreadId}`);
    } catch (error) {
      console.error("Failed to create thread:", error);
      toast.error("Failed to create new thread");
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
      {filteredThreads.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <MessageSquareIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {searchQuery ? `No chats found matching "${searchQuery}"` : "No chats yet"}
          </p>
          <p className="text-xs">
            {searchQuery ? "Try adjusting your search terms" : "Start a new conversation to get started"}
          </p>
        </div>
      ) : (
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