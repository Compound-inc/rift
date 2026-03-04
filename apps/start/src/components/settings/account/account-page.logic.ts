'use client'

import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useAppAuth } from '@/lib/auth/use-auth'
import { requestEmailChange, saveAvatar, updateProfileName } from '@/lib/settings/account'

export type AccountPageLogicResult = {
  name: string
  email: string
  avatarImage: string | null
  avatarMessage: string | null
  nameMessage: string | null
  emailMessage: string | null
  canEdit: boolean
  initials: string
  setNameInput: (nextName: string) => void
  setEmailInput: (nextEmail: string) => void
  submitName: () => Promise<void>
  submitEmail: () => Promise<void>
  persistAvatar: (uploadedUrl: string) => Promise<void>
  applyAvatarChange: (uploadedUrl: string) => void
}

const NAME_SUCCESS_MESSAGE = 'Display name saved.'
const EMAIL_SUCCESS_MESSAGE = 'Email change request submitted. Check your inbox to finish verification.'
const AVATAR_SUCCESS_MESSAGE = 'Avatar saved.'

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

/**
 * Centralized logic for user account settings.
 */
export function useAccountPageLogic(): AccountPageLogicResult {
  const { loading, user, isAnonymous, refetchSession } = useAppAuth()
  const saveAvatarFn = useServerFn(saveAvatar)
  const updateProfileNameFn = useServerFn(updateProfileName)
  const requestEmailChangeFn = useServerFn(requestEmailChange)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarImage, setAvatarImage] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)
  const [nameMessage, setNameMessage] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)


  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setEmail(user.email ?? '')
      setAvatarImage(user.image ?? null)
      setAvatarMessage(null)
      return
    }

    setName('')
    setEmail('')
    setAvatarImage(null)
    setAvatarMessage(null)
  }, [user?.email, user?.image, user?.name])
  const canEdit = !loading && !!user && !isAnonymous
  const initials = getInitials(name, email)

  const setNameInput = (nextName: string) => {
    setNameMessage(null)
    setName(nextName)
  }

  const setEmailInput = (nextEmail: string) => {
    setEmailMessage(null)
    setEmail(nextEmail)
  }

  const submitName = async () => {
    const nextName = name.trim()
    if (!canEdit) {
      setNameMessage('You need to sign in to update your profile.')
      return
    }
    if (!nextName) {
      setNameMessage('Display name cannot be empty.')
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
      setNameMessage(NAME_SUCCESS_MESSAGE)
    } catch (cause) {
      setNameMessage(getErrorMessage(cause, 'Unable to save display name.'))
    }
  }

  const submitEmail = async () => {
    const nextEmail = email.trim().toLowerCase()
    const currentEmail = user?.email?.trim().toLowerCase() ?? ''

    if (!canEdit) {
      setEmailMessage('You need to sign in to update your profile.')
      return
    }
    if (!nextEmail) {
      setEmailMessage('Email cannot be empty.')
      return
    }
    if (nextEmail === currentEmail) {
      setEmailMessage('Please enter a different email address.')
      return
    }

    try {
      await requestEmailChangeFn({
        data: {
          newEmail: nextEmail,
        },
      })
      await refetchSession()
      setEmail(nextEmail)
      setEmailMessage(EMAIL_SUCCESS_MESSAGE)
    } catch (cause) {
      setEmailMessage(getErrorMessage(cause, 'Unable to request email change.'))
    }
  }

  const persistAvatar = async (uploadedUrl: string) => {
    if (!canEdit) {
      throw new Error('You need to sign in to update your avatar.')
    }

    setAvatarMessage(null)
    await saveAvatarFn({
      data: {
        avatarUrl: uploadedUrl,
      },
    })
    await refetchSession()
    setAvatarMessage(AVATAR_SUCCESS_MESSAGE)
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
    avatarImage,
    avatarMessage,
    nameMessage,
    emailMessage,
    canEdit,
    initials,
    setNameInput,
    setEmailInput,
    submitName,
    submitEmail,
    persistAvatar,
    applyAvatarChange,
  }
}
