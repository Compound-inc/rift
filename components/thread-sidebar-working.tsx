"use client";

import { usePreloadedQuery, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ai/ui/button";
import { PinIcon, CheckIcon } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Preloaded } from "convex/react";

interface ThreadSidebarWorkingProps {
  preloadedThreads?: Preloaded<typeof api.threads.getUserThreadsPaginated>;
}

export function ThreadSidebarWorking({
  preloadedThreads,
}: ThreadSidebarWorkingProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Use preloaded data if available
  const preloadedResults = preloadedThreads
    ? usePreloadedQuery(preloadedThreads)
    : null;

  // Always have fallback for pagination
  const fallbackResults = usePaginatedQuery(
    api.threads.getUserThreadsPaginated,
    { paginationOpts: { numItems: 20, cursor: null } },
    { initialNumItems: 20 }
  );

  // Determine which data to use
  const threads = preloadedResults?.page || fallbackResults.results || [];
  const status = preloadedResults
    ? preloadedResults.isDone
      ? "Exhausted"
      : "CanLoadMore"
    : fallbackResults.status;
  const loadMore = (numItems: number) => {
    // Always use fallback loadMore for pagination
    fallbackResults.loadMore(numItems);
  };

  console.log(
    "🔄 ThreadSidebarWorking render - threads:",
    threads.length,
    "preloaded:",
    !!preloadedThreads,
  );

  // Filter threads based on search query
  const filteredThreads = threads.filter((thread) =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Mutations
  const deleteThread = useMutation(api.threads.deleteThread);
  const renameThread = useMutation(api.threads.renameThread);

  // Hydrate the server-rendered search input with interactive functionality
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

      return () => {
        searchInput.removeEventListener("input", handleInputChange);
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

  const handleLoadMore = () => {
    if (status === "CanLoadMore") {
      setIsLoadingMore(true);
      try {
        loadMore(10);
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
      toast.success("Thread deleted");
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Failed to delete thread");
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
      toast.error("Title cannot be empty");
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
      handleSaveEdit(threadId, e as unknown as React.MouseEvent);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleCancelEdit();
    }
  };

  // Show loading state only if we have no threads and no preloaded data
  if (threads.length === 0 && !preloadedThreads && status === "LoadingFirstPage") {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="text-sm">Loading chats...</p>
      </div>
    );
  }

  return (
    <>
      {/* Thread List */}
      {filteredThreads.length === 0 && searchQuery ? (
        <div className="p-4 text-center text-muted-foreground">
          <p className="text-sm">
            No chats found matching &quot;{searchQuery}&quot;
          </p>
          <p className="text-xs">Try adjusting your search terms</p>
        </div>
      ) : (
        filteredThreads.length > 0 && (
          <div className="space-y-0.5 p-3 w-full overflow-hidden">
            {filteredThreads.map((thread) => {
              const isEditing = editingThreadId === thread.threadId;

              return (
                <div
                  key={thread.threadId}
                  onClick={() =>
                    !isEditing && router.push(`/chat/${thread.threadId}`)
                  }
                  className={cn(
                    "group relative flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors overflow-hidden",
                    "hover:bg-hover hover:text-accent-foreground",
                    pathname === `/chat/${thread.threadId}` &&
                      "bg-hover text-accent-foreground",
                    isEditing && "bg-hover text-accent-foreground",
                  )}
                >
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
                  </div>

                  {/* Actions */}
                  <div
                    className="absolute top-0 bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out flex items-center gap-1 bg-white rounded-l-md p-1 translate-x-full group-hover:translate-x-0 shadow-container-small"
                    style={{ maxWidth: "120px" }}
                  >
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
                        onClick={(e) =>
                          handleStartEdit(thread.threadId, thread.title, e)
                        }
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-hover"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 40 40"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3"
                        >
                          <g clipPath="url(#clip0_6_1160)">
                            <path
                              d="M28.8498 5.21018L30.8298 3.2302C32.4702 1.58994 35.1296 1.58994 36.7698 3.2302C38.41 4.87048 38.41 7.52986 36.7698 9.17014L34.7898 11.1501M28.8498 5.21018L15.5312 18.5288C14.5161 19.544 13.7961 20.8156 13.4479 22.2082L12 28L17.7918 26.552C19.1844 26.204 20.456 25.4838 21.4712 24.4688L34.7898 11.1501M28.8498 5.21018L34.7898 11.1501"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinejoin="round"
                            />
                            <path
                              opacity="0.4"
                              d="M33.9998 23C33.9998 29.575 33.9998 32.8624 32.184 35.0752C31.8516 35.4802 31.4802 35.8516 31.075 36.184C28.8624 38 25.5748 38 18.9998 38H18C10.4575 38 6.68632 38 4.34318 35.6568C2.00006 33.3138 2 29.5424 2 22V21C2 14.425 2 11.1376 3.81588 8.92488C4.14834 8.5198 4.5198 8.14834 4.92488 7.81588C7.13758 6 10.425 6 17 6"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </g>
                          <defs>
                            <clipPath id="clip0_6_1160">
                              <rect width="40" height="40" fill="white" />
                            </clipPath>
                          </defs>
                        </svg>
                      </Button>
                    )}
                    <Button
                      onClick={(e) => handleDeleteThread(thread.threadId, e)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-danger/50 hover:text-destructive-foreground"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 40 44"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                      >
                        <g clipPath="url(#clip0_10_1140)">
                          <path
                            opacity="0.4"
                            d="M35.165 29.3128C35.0116 31.8192 34.8898 33.8082 34.6404 35.3968C34.3844 37.0262 33.9748 38.383 33.1554 39.5698C32.4058 40.6556 31.4408 41.572 30.3216 42.2606C29.0982 43.0134 27.7322 43.3426 26.1062 43.5L13.8548 43.4998C12.227 43.342 10.8594 43.0122 9.6352 42.258C8.51526 41.5682 7.54988 40.6502 6.80056 39.5626C5.98146 38.3738 5.57312 37.015 5.31914 35.3834C5.07148 33.7924 4.95246 31.8006 4.80244 29.2906L3.5 7.5H36.5L35.165 29.3128Z"
                            fill="currentColor"
                          />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M15 33.9296C14.1716 33.9296 13.5 33.2582 13.5 32.4296V20.4296C13.5 19.6012 14.1716 18.9296 15 18.9296C15.8284 18.9296 16.5 19.6012 16.5 20.4296V32.4296C16.5 33.2582 15.8284 33.9296 15 33.9296Z"
                            fill="currentColor"
                          />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M25 18.9296C25.8284 18.9296 26.5 19.6012 26.5 20.4296V32.4296C26.5 33.2582 25.8284 33.9296 25 18.9296C24.1716 18.9296 23.5 19.6012 23.5 20.4296V32.4296C23.5 33.2582 24.1716 33.9296 25 33.9296Z"
                            fill="currentColor"
                          />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M22.6946 0.565535C23.8248 0.666615 24.887 1.01152 25.7992 1.69182C26.4738 2.19496 26.9424 2.81084 27.3428 3.47786C27.7138 4.09596 28.0874 4.8666 28.511 5.7408L29.3646 7.5014H38C39.1046 7.5014 40 8.39684 40 9.5014C40 10.606 39.1046 11.5014 38 11.5014C25.9996 11.5014 14.0004 11.5014 2 11.5014C0.89544 11.5014 0 10.606 0 9.5014C0 8.39684 0.89544 7.5014 2 11.5014H10.8195L11.5311 5.94032C11.9442 5.03392 12.3081 4.23564 12.6735 3.59508C13.0677 2.90414 13.5344 2.26474 14.2172 1.74092C15.1406 1.03252 16.2242 0.673375 17.3798 0.568175C18.2498 0.488975 19.1268 0.499875 20 0.501275C21.0216 0.502915 21.94 0.498035 22.6946 0.565535ZM15.2155 7.5014H24.9194C24.466 6.56662 24.176 5.97414 23.9132 5.5364C23.5286 4.89574 23.0678 4.6149 22.3382 4.54964C21.8196 4.50326 21.1438 4.5014 20.069 4.5014C18.9674 4.5014 18.274 4.50332 17.7424 4.5517C16.9942 4.61982 16.5278 4.91136 16.1478 5.57732C15.8988 6.01374 15.6277 6.59794 15.2155 7.5014Z"
                            fill="currentColor"
                          />
                        </g>
                        <defs>
                          <clipPath id="clip0_10_1140">
                            <rect width="40" height="44" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Load More Button */}
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
