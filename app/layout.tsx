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

const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const baseUrl = productionDomain ? `https://${productionDomain}` : "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    template: "%s | Rift",
    default: "Rift",
  },
  description: "Rift AI",
  applicationName: "Rift",
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Rift",
    description: "Rift AI",
    url: baseUrl,
    siteName: "Rift",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rift",
    description: "Rift AI",
    images: ["/twitter-image.png"],
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
            defaultTheme="system"
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
