'use client'

import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { authClient } from '@/lib/auth/auth-client'
import { useAppAuth } from '@/lib/auth/use-auth'
import { requestEmailChange, saveAvatar, updateProfileName } from '@/lib/settings/account'
import { getLocale, locales, setLocale } from '@/paraglide/runtime.js'
import { m } from '@/paraglide/messages.js'

type SupportedLocale = (typeof locales)[number]

export type AccountPageLogicResult = {
  name: string
  email: string
  emailVerificationStatus: 'verified' | 'not-verified' | null
  canResendCurrentEmailVerification: boolean
  language: SupportedLocale
  languageOptions: Array<{ value: SupportedLocale; label: string }>
  languageError: string | null
  avatarImage: string | null
  avatarMessage: string | null
  nameMessage: string | null
  emailMessage: string | null
  canEdit: boolean
  initials: string
  setNameInput: (nextName: string) => void
  setEmailInput: (nextEmail: string) => void
  setLanguageInput: (nextLanguage: SupportedLocale) => void
  applyLanguageSelection: (nextLanguage: SupportedLocale) => Promise<void>
  submitName: () => Promise<void>
  submitEmail: () => Promise<void>
  resendEmailVerification: () => Promise<void>
  persistAvatar: (uploadedUrl: string) => Promise<void>
  applyAvatarChange: (uploadedUrl: string) => void
}

const NAME_SUCCESS_MESSAGE = () => m.settings_account_name_saved()
const EMAIL_SUCCESS_MESSAGE = () => m.settings_account_email_change_requested()
const AVATAR_SUCCESS_MESSAGE = () => m.settings_account_avatar_saved()

function getErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message
  }
  return fallback
}

function getInitials(name: string, email: string): string {
  const normalizedName = name.trim()
  if (normalizedName.length > 0) {
    const parts = normalizedName.split(/\s+/).filter(Boolean)
    const first = parts[0]?.slice(0, 1) ?? ''
    const last = (parts.length > 1 ? parts[parts.length - 1] : '')?.slice(0, 1) ?? ''
    return (first + last).toUpperCase() || '?'
  }

  const emailPrefix = email.split('@')[0] ?? ''
  return emailPrefix.slice(0, 2).toUpperCase() || '?'
}

function getLocaleLabel(targetLocale: SupportedLocale): string {
  try {
    const baseLanguage = targetLocale.split('-')[0] ?? targetLocale
    /**
     * Use endonyms (self-names) for language labels so the selector remains stable
     * regardless of the current UI language (e.g. Hebrew UI still shows "English",
     * "Español", etc., instead of translating them to equivalents).
     */
    const displayNames = new Intl.DisplayNames([baseLanguage], { type: 'language' })
    const localizedLabel = displayNames.of(baseLanguage)
    if (!localizedLabel) return targetLocale
    return localizedLabel.charAt(0).toUpperCase() + localizedLabel.slice(1)
  } catch {
    return targetLocale
  }
}

function resolveSettingsCallbackURLClient(): string {
  const raw = import.meta.env.VITE_BETTER_AUTH_URL?.trim()
  if (!raw) {
    throw new Error('Missing VITE_BETTER_AUTH_URL.')
  }
  return `${raw.replace(/\/+$/, '')}/settings`
}

/**
 * Centralized logic for user account settings.
 */
export function useAccountPageLogic(): AccountPageLogicResult {
  const { loading, user, isAnonymous, emailVerified, refetchSession } = useAppAuth()
  const saveAvatarFn = useServerFn(saveAvatar)
  const updateProfileNameFn = useServerFn(updateProfileName)
  const requestEmailChangeFn = useServerFn(requestEmailChange)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [confirmedEmailTarget, setConfirmedEmailTarget] = useState('')
  const [language, setLanguage] = useState(getLocale())
  const [languageError, setLanguageError] = useState<string | null>(null)
  const [avatarImage, setAvatarImage] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)
  const [nameMessage, setNameMessage] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)


  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setEmail(user.email ?? '')
      setConfirmedEmailTarget(user.email ?? '')
      setAvatarImage(user.image ?? null)
      setAvatarMessage(null)
      return
    }

    setName('')
    setEmail('')
    setConfirmedEmailTarget('')
    setAvatarImage(null)
    setAvatarMessage(null)
  }, [user?.email, user?.image, user?.name])
  const canEdit = !loading && !!user && !isAnonymous
  const initials = getInitials(name, email)
  const normalizedCurrentEmail = user?.email?.trim().toLowerCase() ?? ''
  const normalizedDraftEmail = email.trim().toLowerCase()
  const normalizedConfirmedEmailTarget = confirmedEmailTarget.trim().toLowerCase()
  const isEditingCurrentEmail = normalizedDraftEmail === normalizedCurrentEmail
  const emailVerificationStatus =
    normalizedConfirmedEmailTarget.length === 0
      ? null
      : normalizedConfirmedEmailTarget === normalizedCurrentEmail && emailVerified
        ? 'verified'
        : 'not-verified'
  const canResendCurrentEmailVerification =
    canEdit && isEditingCurrentEmail && normalizedDraftEmail.length > 0 && !emailVerified
  const languageOptions = locales.map((localeCode) => ({
    value: localeCode,
    label: getLocaleLabel(localeCode),
  }))

  const setNameInput = (nextName: string) => {
    setNameMessage(null)
    setName(nextName)
  }

  const setEmailInput = (nextEmail: string) => {
    setEmailMessage(null)
    setEmail(nextEmail)
  }

  const setLanguageInput = (nextLanguage: SupportedLocale) => {
    setLanguageError(null)
    setLanguage(nextLanguage)
  }

  const applyLanguageSelection = async (nextLanguage: SupportedLocale) => {
    if (nextLanguage === language) return
    setLanguageError(null)
    setLanguage(nextLanguage)

    /**
     * Keep locale transitions authoritative and consistent by delegating to Paraglide.
     * `setLocale` persists the locale via strategy (cookie) and triggers a full reload,
     * ensuring translated strings and direction-sensitive layout are in sync globally.
     */
    try {
      await Promise.resolve(setLocale(nextLanguage))
    } catch {
      setLanguageError(m.settings_account_language_error_default())
    }
  }

  const submitName = async () => {
    const nextName = name.trim()
    if (!canEdit) {
      setNameMessage(m.settings_account_error_sign_in_required_profile())
      return
    }
    if (!nextName) {
      setNameMessage(m.settings_account_error_name_empty())
      return
    }

    try {
      await updateProfileNameFn({
        data: {
          name: nextName,
        },
      })
      await refetchSession()
      setName(nextName)
      setNameMessage(NAME_SUCCESS_MESSAGE())
    } catch (cause) {
      setNameMessage(getErrorMessage(cause, m.settings_account_error_name_save_failed()))
    }
  }

  const submitEmail = async () => {
    const nextEmail = email.trim().toLowerCase()
    const currentEmail = user?.email?.trim().toLowerCase() ?? ''

    if (!canEdit) {
      setEmailMessage(m.settings_account_error_sign_in_required_profile())
      return
    }
    if (!nextEmail) {
      setEmailMessage(m.settings_account_error_email_empty())
      return
    }
    if (nextEmail === currentEmail) {
      setEmailMessage(m.settings_account_error_email_same())
      return
    }

    try {
      await requestEmailChangeFn({
        data: {
          newEmail: nextEmail,
        },
      })
      await refetchSession()
      setConfirmedEmailTarget(nextEmail)
      setEmail(nextEmail)
      setEmailMessage(EMAIL_SUCCESS_MESSAGE())
    } catch (cause) {
      setEmailMessage(getErrorMessage(cause, m.settings_account_error_email_change_failed()))
    }
  }

  const resendEmailVerification = async () => {
    const nextEmail = email.trim().toLowerCase()
    const currentEmail = user?.email?.trim().toLowerCase() ?? ''

    if (!canEdit) {
      setEmailMessage(m.settings_account_error_sign_in_required_profile())
      return
    }
    if (!nextEmail) {
      setEmailMessage(m.settings_account_error_email_empty())
      return
    }
    try {
      if (nextEmail === currentEmail) {
        await authClient.sendVerificationEmail({
          email: nextEmail,
          callbackURL: resolveSettingsCallbackURLClient(),
        })
      } else {
        await requestEmailChangeFn({
          data: {
            newEmail: nextEmail,
          },
        })
      }
      await refetchSession()
      setEmail(nextEmail)
      setEmailMessage(EMAIL_SUCCESS_MESSAGE())
    } catch (cause) {
      setEmailMessage(getErrorMessage(cause, m.settings_account_error_email_change_failed()))
    }
  }

  const persistAvatar = async (uploadedUrl: string) => {
    if (!canEdit) {
      throw new Error(m.settings_account_error_sign_in_required_avatar())
    }

    setAvatarMessage(null)
    await saveAvatarFn({
      data: {
        avatarUrl: uploadedUrl,
      },
    })
    await refetchSession()
    setAvatarMessage(AVATAR_SUCCESS_MESSAGE())
  }

  const applyAvatarChange = (uploadedUrl: string) => {
    /**
     * Keep the latest success feedback visible after persistence completes.
     * `persistAvatar` already clears stale feedback at the start of a new upload attempt,
     * so resetting it here would immediately hide the fresh success message.
     */
    setAvatarImage(uploadedUrl)
  }

  return {
    name,
    email,
    emailVerificationStatus,
    canResendCurrentEmailVerification,
    language,
    languageOptions,
    languageError,
    avatarImage,
    avatarMessage,
    nameMessage,
    emailMessage,
    canEdit,
    initials,
    setNameInput,
    setEmailInput,
    setLanguageInput,
    applyLanguageSelection,
    submitName,
    submitEmail,
    resendEmailVerification,
    persistAvatar,
    applyAvatarChange,
  }
}
