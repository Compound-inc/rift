import { ChatMessagesServer } from "@/components/chat-messages-server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getAccessToken } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return {
        title: "Chat",
      };
    }

    // Fetch thread info to get the title
    const threadInfo = await fetchQuery(
      api.threads.getThreadInfo,
      { threadId: id },
      { token: accessToken },
    );
    
    if (threadInfo?.title) {
      return {
        title: threadInfo.title,
      };
    }
  } catch (error) {
    // If any error occurs, fall back to generic title
    console.error("Error fetching thread title:", error);
  }

  return {
    title: "Chat",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ChatMessagesServer threadId={id} />;
}
