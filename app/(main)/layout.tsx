import "@/styles/globals.css";
import { ModelProvider } from "@/contexts/model-context";
import { cookies } from "next/headers";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ChatCacheProvider } from "@/contexts/chat-cache";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialModel = cookieStore.get("selectedModel")?.value;

  return (
      <ModelProvider initialModel={initialModel}>
        <ChatCacheProvider>
        {children}
      </ChatCacheProvider>
      </ModelProvider>
  );
}
