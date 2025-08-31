import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "next-themes";
import { Providers } from "./providers";
import ChatShell from "@/components/ai/ChatShell";
import ThreadSidebar from "@/components/thread-sidebar";
import { cookies } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | AI Chat",
    default: "AI Chat",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialModel = cookieStore.get("selectedModel")?.value;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className={`bg-background selection:bg-sidebar-logo relative antialiased selection:text-white dark:selection:text-black`}
      >
        <ConvexClientProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <Providers initialModel={initialModel}>
              <ChatShell sidebar={<ThreadSidebar />}>
                {children}
              </ChatShell>
            </Providers>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
