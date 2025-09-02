import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAccessToken } from "@/lib/auth";
import { ThreadSidebarClient } from "./thread-sidebar-client-component";

// Server component for preloading thread data

export async function ThreadSidebarServer() {
  // Get the user's access token
  const accessToken = await getAccessToken();

  // If no access token, render without preloaded data
  if (!accessToken) {
    return <ThreadSidebarClient />;
  }

  try {
    // Preload the user's threads using their token
    const preloadedThreads = await preloadQuery(
      api.threads.getUserThreadsPaginated,
      { paginationOpts: { numItems: 20, cursor: null } },
      { token: accessToken },
    );

    return <ThreadSidebarClient preloadedThreads={preloadedThreads} />;
  } catch (error) {
    console.error("Failed to preload threads:", error);
    // Fallback to client-side loading on error
    return <ThreadSidebarClient />;
  }
}
