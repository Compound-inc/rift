"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import ChatList from "./chat-list";

// Use a default guest user ID for all users since we removed authentication
const GUEST_USER_ID = "guest-user";

export default function SidebarHistory() {
  // Load chat history for the guest user
  const chatHistory = useQuery(
    api.chats.getChatHistory, 
    { userId: GUEST_USER_ID }
  );

  if (chatHistory === undefined) {
    return <div>Loading chat history...</div>;
  }

  // The chatHistory already has the correct ConvexChat structure
  return <ChatList chats={chatHistory} />;
}
