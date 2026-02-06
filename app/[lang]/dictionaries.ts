import "server-only";
import type { Dictionary, Locale } from "@/types/dictionary";

const dictionaries = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  es: () => import("./dictionaries/es.json").then((m) => m.default),
};

export type { Dictionary, Locale };

export const hasLocale = (locale: string): locale is Locale =>
  Object.hasOwn(dictionaries, locale);

export const getDictionary = async (locale: Locale): Promise<Dictionary> =>
  dictionaries[locale]() as Promise<Dictionary>;
