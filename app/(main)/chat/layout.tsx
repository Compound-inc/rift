"use client";

import ChatShell from "@/components/ai/ChatShell";
import ThreadSidebar from "@/components/thread-sidebar";

export default function ChatLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ChatShell sidebar={<ThreadSidebar />}>{children}</ChatShell>
  );
} 