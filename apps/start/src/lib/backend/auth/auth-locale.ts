import { baseLocale, locales } from '@/paraglide/runtime.js'

export type SupportedAuthLocale = (typeof locales)[number]

const DEFAULT_AUTH_LOCALE: SupportedAuthLocale = baseLocale

/**
 * Narrows arbitrary locale-like values to the locales supported by Paraglide.
 * Supports direct matches ("es") and regional tags ("es-MX" -> "es").
 */
export function normalizeSupportedLocale(input: string | null | undefined): SupportedAuthLocale | null {
  if (!input) return null
  const normalized = input.trim().toLowerCase()
  if (!normalized) return null

  for (const locale of locales) {
    if (normalized === locale) {
      return locale
    }
  }

  const languagePart = normalized.split('-')[0]
  if (!languagePart) return null
  for (const locale of locales) {
    if (locale === languagePart) {
      return locale
    }
  }

  return null
}

/**
 * Best-effort Accept-Language parser that returns the highest-priority supported locale.
 */
export function resolveLocaleFromAcceptLanguage(
  acceptLanguageHeader: string | null | undefined,
): SupportedAuthLocale {
  if (!acceptLanguageHeader) {
    return DEFAULT_AUTH_LOCALE
  }

  const candidates = acceptLanguageHeader
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token, index) => {
      const [rawTag, ...params] = token.split(';').map((part) => part.trim())
      let quality = 1
      for (const param of params) {
        if (!param.startsWith('q=')) continue
        const parsed = Number(param.slice(2))
        if (!Number.isNaN(parsed)) {
          quality = parsed
        }
      }
      return {
        tag: rawTag,
        quality,
        index,
      }
    })
    .sort((left, right) => {
      if (left.quality !== right.quality) return right.quality - left.quality
      return left.index - right.index
    })

  for (const candidate of candidates) {
    const locale = normalizeSupportedLocale(candidate.tag)
    if (locale) return locale
  }

  return DEFAULT_AUTH_LOCALE
}

export function getDefaultAuthLocale(): SupportedAuthLocale {
  return DEFAULT_AUTH_LOCALE
}

