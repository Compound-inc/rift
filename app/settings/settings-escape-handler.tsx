"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function SettingsEscapeHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        router.push("/chat");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [router]);

  return null;
}
