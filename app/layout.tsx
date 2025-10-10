import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "next-themes";
import { Providers } from "./providers";
import { cookies } from "next/headers";

const inter = Inter({
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Rift",
    default: "Rift",
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
    <html lang="en" className={`${inter.className}`} suppressHydrationWarning>
      <body className={`bg-background relative antialiased`}>
        <ConvexClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <Providers initialModel={initialModel}>{children}</Providers>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
