import {
  getDefaultAuthLocale,
  normalizeSupportedLocale,
  resolveLocaleFromAcceptLanguage,
} from './auth-locale'
import type { SupportedAuthLocale } from './auth-locale'
import {
  readStoredLocaleValueByUserIdEffect,
  runAuthSqlEffect,
  updateStoredLocaleValueEffect,
} from './auth-sql.server'

async function readStoredLocaleByUserId(userId: string): Promise<SupportedAuthLocale | null> {
  const locale = await runAuthSqlEffect(
    readStoredLocaleValueByUserIdEffect(userId),
  )
  return normalizeSupportedLocale(locale)
}

/**
 * Resolves locale by account user id and falls back to Accept-Language/defaults.
 */
export async function resolveAccountLocale(input: {
  userId: string | null | undefined
  fallbackAcceptLanguageHeader?: string | null
}): Promise<SupportedAuthLocale> {
  if (input.userId) {
    const storedLocale = await readStoredLocaleByUserId(input.userId)
    if (storedLocale) return storedLocale
  }

  const fromHeader = resolveLocaleFromAcceptLanguage(input.fallbackAcceptLanguageHeader)
  return fromHeader ?? getDefaultAuthLocale()
}

/**
 * Reads the stored account locale by user id and falls back to app default.
 */
export async function resolveAccountLocaleByUserId(userId: string): Promise<SupportedAuthLocale> {
  return resolveAccountLocale({ userId })
}

/**
 * Updates the persisted account locale for the provided user.
 */
export async function updateAccountLocale(input: {
  userId: string
  locale: SupportedAuthLocale
}): Promise<void> {
  await runAuthSqlEffect(
    updateStoredLocaleValueEffect({
      userId: input.userId,
      locale: input.locale,
    }),
  )
}
