import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics as DubAnalytics } from "@dub/analytics/react";
import "@/styles/globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "next-themes";
import { Providers } from "./providers";

const inter = Inter({
  weight: ["400"],
  subsets: ["latin"],
});

const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const baseUrl = productionDomain ? `https://${productionDomain}` : "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfb" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export const metadata: Metadata = {
  title: {
    template: "%s | Rift",
    default: "Rift",
  },
  description: "Plataforma que unifica todos los modelos de IA en una sola app empresarial.",
  applicationName: "Rift",
  metadataBase: new URL(baseUrl),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rift",
  },
  alternates: {
    canonical: "/",
  },
  keywords: [
    "rift",
    "inteligencia artificial",
    "ia empresarial",
    "plataforma global ia",
    "chatgpt",
    "anthropic",
    "google gemini",
    "deepseek",
    "mistral",
    "ia para escuela",
    "ia para negocios",
    "ia educacional",

  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Rift",
    description: "Todas las IAs, una sola plataforma",
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
    description: "Todas las IAs, una sola plataforma",
    images: ["/twitter-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.className}`} suppressHydrationWarning>
      <body className={`bg-[#FBFBFB] dark:bg-[#111113] relative antialiased`}>
        <ConvexClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Providers>{children}</Providers>
          </ThemeProvider>
        </ConvexClientProvider>
        <DubAnalytics
          publishableKey={process.env.NEXT_PUBLIC_DUB_PUBLISHABLE_KEY}
          apiHost={process.env.NEXT_PUBLIC_DUB_API_HOST}
        />
      </body>
    </html>
  );
}
