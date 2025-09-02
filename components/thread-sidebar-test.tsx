"use client";

import { usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Preloaded } from "convex/react";
import { useEffect } from "react";

interface ThreadSidebarTestProps {
  preloadedThreads?: Preloaded<typeof api.threads.getUserThreadsPaginated>;
}

export function ThreadSidebarTest({ preloadedThreads }: ThreadSidebarTestProps) {
  console.log("🧪 TEST: Component render - has preloaded data:", !!preloadedThreads);

  useEffect(() => {
    console.log("🧪 TEST: Component mounted");
  }, []);

  if (!preloadedThreads) {
    return (
      <div className="p-4 bg-red-100 border border-red-300">
        <h3 className="font-bold text-red-800">TEST: No Preloaded Data</h3>
        <p className="text-red-600">Server-side preloading failed or not available</p>
      </div>
    );
  }

  const preloadedResults = usePreloadedQuery(preloadedThreads);
  const threads = preloadedResults.page || [];

  console.log("🧪 TEST: Preloaded results:", {
    isDone: preloadedResults.isDone,
    threadCount: threads.length,
    firstThread: threads[0]?.title,
    continueCursor: preloadedResults.continueCursor
  });

  return (
    <div className="p-4 bg-green-100 border border-green-300">
      <h3 className="font-bold text-green-800 mb-2">TEST: Preloaded Data Available!</h3>
      <div className="text-sm text-green-700 space-y-1">
        <p><strong>Thread Count:</strong> {threads.length}</p>
        <p><strong>Is Done:</strong> {preloadedResults.isDone ? 'Yes' : 'No'}</p>
        <p><strong>Has Cursor:</strong> {preloadedResults.continueCursor ? 'Yes' : 'No'}</p>
      </div>

      <div className="mt-3">
        <h4 className="font-semibold text-green-800">First 3 Threads:</h4>
        <ul className="text-xs text-green-600 ml-4 list-disc">
          {threads.slice(0, 3).map((thread, index) => (
            <li key={thread.threadId || index}>
              {thread.title} (ID: {thread.threadId?.slice(0, 8)}...)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
