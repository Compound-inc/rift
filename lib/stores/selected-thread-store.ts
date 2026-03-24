import { create } from "zustand";

const LOCALES = ["en", "es"] as const;

function parseThreadIdFromPathname(pathname: string): string | null {
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
  // /chat, /chat/<id>
  if (parts.length === 1 && parts[0] === "chat") return null;
  if (parts.length === 2 && parts[0] === "chat") return parts[1] || null;
  // /[lang]/chat, /[lang]/chat/<id>
  if (parts.length === 2 && LOCALES.includes(parts[0] as (typeof LOCALES)[number]) && parts[1] === "chat") return null;
  if (parts.length === 3 && LOCALES.includes(parts[0] as (typeof LOCALES)[number]) && parts[1] === "chat") return parts[2] || null;
  return null;
}

type SelectedThreadState = {
  selectedThreadId: string | null;
  setSelectedThreadId: (threadId: string | null) => void;
  clearSelectedThreadId: () => void;
};

export const useSelectedThreadStore = create<SelectedThreadState>((set) => ({
  selectedThreadId:
    typeof window !== "undefined"
      ? parseThreadIdFromPathname(window.location.pathname)
      : null,
  setSelectedThreadId: (threadId) => set({ selectedThreadId: threadId }),
  clearSelectedThreadId: () => set({ selectedThreadId: null }),
}));


