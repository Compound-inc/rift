import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAccessToken } from "@/lib/auth";
import { ThreadSidebarClient } from "./thread-sidebar-client-component";

// Server component for preloading thread data
export async function ThreadSidebarServer() {
  try {
    const accessToken = await getAccessToken();

    // If no access token, render without preloaded data
    if (!accessToken) {
      return <ThreadSidebarClient />;
    }

    // Preload the user's threads using their token
    const preloadedThreads = await preloadQuery(
      api.threads.getUserThreadsPaginatedSafe,
      { paginationOpts: { numItems: 20, cursor: null } },
      { token: accessToken },
    );

    return <ThreadSidebarClient preloadedThreads={preloadedThreads} />;
  } catch {
    return <ThreadSidebarClient />;
  }
}
