import ChatShell from "@/components/ai/ChatShell";
import { ThreadSidebar } from "@/components/sidebar";
import { NoOrgModal } from "@/components/ai/NoOrgModal";
import { ModelProvider } from "@/contexts/model-context";
import { cookies } from "next/headers";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialModel = cookieStore.get("selectedModel")?.value;

  return (
    <ModelProvider initialModel={initialModel}>
      <NoOrgModal />
      <ChatShell sidebar={<ThreadSidebar />}>
        {children}
      </ChatShell>
    </ModelProvider>
  );
}
