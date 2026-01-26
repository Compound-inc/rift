"use client";

import { InitialMessageProvider } from "@/contexts/initial-message-context";
import { Theme } from "@radix-ui/themes";
import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { Toaster } from "@/components/ai/ui/sonner";

interface ProvidersProps {
  children: ReactNode;
}

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((mod) => mod.Analytics),
  { ssr: false }
);

const isProd = process.env.NODE_ENV === "production";

export function Providers({ children }: ProvidersProps) {
  return (
    <Theme>
      {isProd ? <Analytics /> : null}
      <Toaster />
      <InitialMessageProvider>{children}</InitialMessageProvider>
    </Theme>
  );
}
