"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { Dictionary, Locale } from "@/types/dictionary";

type LocaleContextValue = {
  lang: Locale;
  dict: Dictionary;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({
  lang,
  dictionary,
  children,
}: {
  lang: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ lang, dict: dictionary }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  const ctx = useContext(LocaleContext);
  if (ctx === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx.lang;
}

export function useDictionary(): Dictionary {
  const ctx = useContext(LocaleContext);
  if (ctx === undefined) {
    throw new Error("useDictionary must be used within a LocaleProvider");
  }
  return ctx.dict;
}

/** Convenience hook for chat UI strings. Use useDictionary() if you need other sections. */
export function useChatTranslations() {
  return useDictionary().chat;
}
