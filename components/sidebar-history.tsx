"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Pin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";

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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <ScrollArea ref={scrollRef} className="h-full">
      <div className="space-y-1 p-2">
        {results.map((thread: ThreadItem) => {
          const isActive = pathname === `/chat/${thread.threadId}`;
          
          return (
            <Link
              key={thread.threadId}
              href={`/chat/${thread.threadId}`}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {thread.pinned && (
                    <Pin className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                  )}
                  <span className="truncate font-medium">
                    {thread.title}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(thread.updatedAt)}
                </div>
              </div>
            </Link>
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
