'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { useAppAuth } from '@/lib/auth/use-auth'
import { m } from '@/paraglide/messages.js'

export type SecurityPageLogicResult = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  passwordMessage: string | null
  canEdit: boolean
  setCurrentPasswordInput: (nextValue: string) => void
  setNewPasswordInput: (nextValue: string) => void
  setConfirmPasswordInput: (nextValue: string) => void
  submitPasswordChange: () => Promise<void>
}

function getErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return normalizeSecurityErrorMessage(cause.message, fallback)
  }
  return fallback
}

/**
 * Maps provider-specific auth errors to user-facing copy that explains what action to take.
 */
function normalizeSecurityErrorMessage(message: string, fallback: string): string {
  const normalizedMessage = message.trim()
  const lowerCaseMessage = normalizedMessage.toLowerCase()

  if (
    lowerCaseMessage === 'invalid password' ||
    lowerCaseMessage.includes('invalid password')
  ) {
    return m.settings_security_error_current_invalid()
  }

  return normalizedMessage.length > 0 ? normalizedMessage : fallback
}

function readBetterAuthResultError(result: unknown): string | null {
  if (result == null || typeof result !== 'object') {
    return null
  }

  const error = (result as { error?: unknown }).error
  if (error == null) {
    return null
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return normalizeSecurityErrorMessage(error, m.settings_security_error_default())
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return normalizeSecurityErrorMessage(error.message, m.settings_security_error_default())
  }

  const message = (error as { message?: unknown }).message
  if (typeof message === 'string' && message.trim().length > 0) {
    return normalizeSecurityErrorMessage(message, m.settings_security_error_default())
  }

  return m.settings_security_error_default()
}

/**
 * Centralized logic for password update settings.
 */
export function useSecurityPageLogic(): SecurityPageLogicResult {
  const { loading, user, isAnonymous } = useAppAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const canEdit = !loading && !!user && !isAnonymous

  const setCurrentPasswordInput = (nextValue: string) => {
    setPasswordMessage(null)
    setCurrentPassword(nextValue)
  }

  const setNewPasswordInput = (nextValue: string) => {
    setPasswordMessage(null)
    setNewPassword(nextValue)
  }

  const setConfirmPasswordInput = (nextValue: string) => {
    setPasswordMessage(null)
    setConfirmPassword(nextValue)
  }

  const submitPasswordChange = async () => {
    const normalizedCurrentPassword = currentPassword.trim()
    const normalizedNewPassword = newPassword.trim()
    const normalizedConfirmPassword = confirmPassword.trim()

    if (!canEdit) {
      setPasswordMessage(m.settings_security_error_sign_in_required())
      return
    }
    if (!normalizedCurrentPassword) {
      setPasswordMessage(m.settings_security_error_current_required())
      return
    }
    if (!normalizedNewPassword) {
      setPasswordMessage(m.settings_security_error_new_required())
      return
    }
    if (!normalizedConfirmPassword) {
      setPasswordMessage(m.settings_security_error_confirm_required())
      return
    }
    if (normalizedNewPassword !== normalizedConfirmPassword) {
      setPasswordMessage(m.settings_security_error_password_mismatch())
      return
    }
    if (normalizedCurrentPassword === normalizedNewPassword) {
      setPasswordMessage(m.settings_security_error_password_unchanged())
      return
    }

    try {
      const result = await authClient.changePassword({
        currentPassword: normalizedCurrentPassword,
        newPassword: normalizedNewPassword,
        revokeOtherSessions: true,
      })
      const apiErrorMessage = readBetterAuthResultError(result)
      if (apiErrorMessage != null) {
        setPasswordMessage(apiErrorMessage)
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage(m.settings_security_success())
    } catch (cause) {
      setPasswordMessage(getErrorMessage(cause, m.settings_security_error_default()))
    }
  }

  return {
    currentPassword,
    newPassword,
    confirmPassword,
    passwordMessage,
    canEdit,
    setCurrentPasswordInput,
    setNewPasswordInput,
    setConfirmPasswordInput,
    submitPasswordChange,
  }
}
