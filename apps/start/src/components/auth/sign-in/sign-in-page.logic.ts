'use client'

import { useServerFn } from '@tanstack/react-start'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { m } from '@/paraglide/messages.js'
import { authClient } from '@/lib/auth/auth-client'
import { getInvitationEmailForAuth } from '@/lib/auth/invitation.functions'
import {
  getDefaultAuthDisplayName,
  normalizeEmailAddress,
  OTP_EXPIRES_IN_SECONDS,
} from '@/components/auth/auth-shared'

/** Redirect target derived from search.redirect; defaults to /chat. */
export function getRedirectTarget(redirect: string | undefined): string {
  if (!redirect) return '/chat'
  return redirect.startsWith('/') ? redirect : '/chat'
}

export type SignInPageView =
  | 'auth-form'
  | 'forgot-password'
  | 'email-verification'
  | 'mfa-verification'

export type SignInPageLogicResult = {
  view: SignInPageView
  isSignUp: boolean
  invitationEmail: string
  invitationLookupLoading: boolean
  pendingVerificationEmail: string
  pendingMfaEmail: string
  verificationMessage: string
  otpSentAt: number | null
  otpExpiresInSeconds: number
  isLoading: boolean
  error: string
  clearError: () => void
  handleToggleMode: () => void
  handleShowForgotPassword: () => void
  handleBackToLogin: () => void
  /** Single submit handler: sign-in or sign-up based on current isSignUp. */
  handleAuthSubmit: (email: string, password: string) => Promise<void>
  handleVerifyEmailOtp: (otp: string) => Promise<void>
  handleVerifyMfaTotp: (otp: string) => Promise<void>
  handleResendVerificationOtp: () => Promise<void>
  handleBackFromMfa: () => void
}

type InvitationAcceptanceResponse = {
  invitation?: { organizationId?: string }
  member?: { organizationId?: string }
}


function readAuthErrorMessage(error: { message?: string; code?: string } | null | undefined, fallback: string) {
  if (!error) return fallback

  if (error.code === 'TOO_MANY_ATTEMPTS') {
    return m.auth_error_too_many_attempts()
  }

  return error.message ?? fallback
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function readBooleanField(source: Record<string, unknown> | null, keys: Array<string>): boolean | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'boolean') return value
  }
  return null
}

/**
 * Better Auth may return the 2FA redirect flag either at the top-level result
 * or nested under `data`, depending on the client method/callback shape.
 */
function requiresTwoFactorVerification(result: unknown): boolean {
  const root = readRecord(result)
  const data = readRecord(root?.data)

  return (
    readBooleanField(root, ['twoFactorRedirect']) === true ||
    readBooleanField(data, ['twoFactorRedirect']) === true
  )
}

/**
 * Logic for the sign-in/sign-up page: toggle mode, forgot password flow,
 * and auth submit (sign-in or sign-up) with redirect.
 */
export function useSignInPageLogic(
  redirectTarget: string,
  initialMode: 'sign-in' | 'sign-up' = 'sign-in',
  invitationId?: string,
): SignInPageLogicResult {
  const navigate = useNavigate()
  const getInvitationEmailForAuthFn = useServerFn(getInvitationEmailForAuth)
  const [isSignUp, setIsSignUp] = useState(initialMode === 'sign-up')
  const [view, setView] = useState<SignInPageView>('auth-form')
  const [invitationEmail, setInvitationEmail] = useState('')
  const [invitationLookupLoading, setInvitationLookupLoading] = useState(false)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('')
  const [pendingVerificationPassword, setPendingVerificationPassword] = useState('')
  const [pendingMfaEmail, setPendingMfaEmail] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const clearError = useCallback(() => {
    setError('')
  }, [])

  useEffect(() => {
    if (!invitationId) {
      setInvitationEmail('')
      setInvitationLookupLoading(false)
      return
    }

    let cancelled = false
    setInvitationLookupLoading(true)

    void getInvitationEmailForAuthFn({
      data: {
        invitationId,
      },
    })
      .then((result) => {
        if (cancelled) return

        if (result.status === 'available') {
          setInvitationEmail(result.email)
          setError((currentError) =>
            currentError === m.auth_invitation_use_invited_email() ? '' : currentError,
          )
          return
        }

        setInvitationEmail('')
      })
      .catch(() => {
        if (!cancelled) {
          setInvitationEmail('')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInvitationLookupLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [getInvitationEmailForAuthFn, invitationId])

  const validateInvitationEmail = useCallback(
    (email: string) => {
      if (!invitationEmail) return true

      if (normalizeEmailAddress(email) !== invitationEmail) {
        setError(m.auth_invitation_use_invited_email())
        return false
      }

      return true
    },
    [invitationEmail],
  )

  const openEmailVerificationStep = useCallback(
    (email: string, password: string, message: string) => {
      setPendingVerificationEmail(email)
      setPendingVerificationPassword(password)
      setVerificationMessage(message)
      setOtpSentAt(Date.now())
      setView('email-verification')
    },
    [],
  )

  const openMfaVerificationStep = useCallback((email: string) => {
    setPendingVerificationEmail('')
    setPendingVerificationPassword('')
    setVerificationMessage('')
    setOtpSentAt(null)
    setPendingMfaEmail(email)
    setView('mfa-verification')
  }, [])

  /**
   * Invitation links should complete membership assignment before the user lands
   * in the app. Doing this in-place avoids a race where the next route reads the
   * fresh session before Better Auth's client cache has caught up.
   */
  const finalizeAuthenticatedNavigation = useCallback(async () => {
    if (!invitationId) {
      void navigate({ to: redirectTarget })
      return true
    }

    const { data, error } = await authClient.organization.acceptInvitation({
      invitationId,
    })

    if (error) {
      setError(readAuthErrorMessage(error, m.auth_error_unexpected()))
      return false
    }

    const invitationResult = data as InvitationAcceptanceResponse | null
    const organizationId =
      invitationResult?.invitation?.organizationId ??
      invitationResult?.member?.organizationId

    if (organizationId) {
      const { error: setActiveError } = await authClient.organization.setActive({
        organizationId,
      })

      if (setActiveError) {
        setError(readAuthErrorMessage(setActiveError, m.auth_error_unexpected()))
        return false
      }
    }

    void navigate({ to: '/chat' })
    return true
  }, [invitationId, navigate, redirectTarget])

  const attemptCredentialSignIn = useCallback(async (email: string, password: string) => {
    let requiresTwoFactor = false

    const result = await authClient.signIn.email(
      {
        email,
        password,
      },
      {
        onSuccess(context) {
          requiresTwoFactor =
            requiresTwoFactor ||
            requiresTwoFactorVerification(context) ||
            requiresTwoFactorVerification(context.data)
        },
      },
    )

    return {
      ...result,
      requiresTwoFactor: requiresTwoFactor || requiresTwoFactorVerification(result),
    }
  }, [])

  const handleToggleMode = useCallback(() => {
    setIsSignUp((prev) => !prev)
    setView('auth-form')
    setPendingVerificationEmail('')
    setPendingVerificationPassword('')
    setPendingMfaEmail('')
    setVerificationMessage('')
    setOtpSentAt(null)
    setError('')
  }, [])

  const handleShowForgotPassword = useCallback(() => {
    setView('forgot-password')
    setPendingVerificationEmail('')
    setPendingVerificationPassword('')
    setPendingMfaEmail('')
    setVerificationMessage('')
    setOtpSentAt(null)
    setError('')
  }, [])

  const handleBackToLogin = useCallback(() => {
    setIsSignUp(false)
    setView('auth-form')
    setPendingVerificationEmail('')
    setPendingVerificationPassword('')
    setPendingMfaEmail('')
    setVerificationMessage('')
    setOtpSentAt(null)
    setError('')
  }, [])

  const handleSignInSubmit = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = normalizeEmailAddress(email)

      if (!validateInvitationEmail(normalizedEmail)) {
        return
      }

      setIsLoading(true)
      setError('')

      const result = await attemptCredentialSignIn(normalizedEmail, password)
      setIsLoading(false)

      if (result.error) {
        if (result.error.status === 403) {
          const otpResult = await authClient.emailOtp.sendVerificationOtp({
            email: normalizedEmail,
            type: 'email-verification',
          })

          if (otpResult.error) {
            setError(
              readAuthErrorMessage(
                otpResult.error,
                m.auth_error_send_verification_failed(),
              ),
            )
            return
          }

          openEmailVerificationStep(
            normalizedEmail,
            password,
            m.auth_error_email_not_verified(),
          )
          return
        }

        setError(readAuthErrorMessage(result.error, m.auth_error_unexpected()))
        return
      }

      if (result.requiresTwoFactor) {
        setIsLoading(false)
        openMfaVerificationStep(normalizedEmail)
        return
      }

      const navigated = await finalizeAuthenticatedNavigation()
      if (!navigated) {
        setIsLoading(false)
      }
    },
    [
      attemptCredentialSignIn,
      finalizeAuthenticatedNavigation,
      navigate,
      openEmailVerificationStep,
      openMfaVerificationStep,
      redirectTarget,
      validateInvitationEmail,
    ],
  )

  const handleSignUpSubmit = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = normalizeEmailAddress(email)

      if (!validateInvitationEmail(normalizedEmail)) {
        return
      }

      setIsLoading(true)
      setError('')

      const { error } = await authClient.signUp.email({
        name: getDefaultAuthDisplayName(normalizedEmail),
        email: normalizedEmail,
        password,
      })
      setIsLoading(false)

      if (error) {
        setError(readAuthErrorMessage(error, m.auth_error_unexpected()))
        return
      }

      openEmailVerificationStep(normalizedEmail, password, '')
    },
    [openEmailVerificationStep, validateInvitationEmail],
  )

  const handleAuthSubmit = useCallback(
    async (email: string, password: string) => {
      if (isSignUp) {
        await handleSignUpSubmit(email, password)
      } else {
        await handleSignInSubmit(email, password)
      }
    },
    [isSignUp, handleSignInSubmit, handleSignUpSubmit],
  )

  const handleVerifyEmailOtp = useCallback(
    async (otp: string) => {
      if (!pendingVerificationEmail || !pendingVerificationPassword) {
        setError(m.auth_error_verify_first())
        return
      }

      setIsLoading(true)
      setError('')

      const verifyResult = await authClient.emailOtp.verifyEmail({
        email: pendingVerificationEmail,
        otp,
      })

      if (verifyResult.error) {
        setIsLoading(false)
        setError(
          readAuthErrorMessage(
            verifyResult.error,
            m.auth_error_invalid_or_expired_code(),
          ),
        )
        return
      }

      const signInResult = await attemptCredentialSignIn(
        pendingVerificationEmail,
        pendingVerificationPassword,
      )

      setIsLoading(false)

      if (signInResult.error) {
        setError(
          readAuthErrorMessage(
            signInResult.error,
            m.auth_error_verified_but_sign_in_failed(),
          ),
        )
        return
      }

      if (signInResult.requiresTwoFactor) {
        setIsLoading(false)
        openMfaVerificationStep(pendingVerificationEmail)
        return
      }

      const navigated = await finalizeAuthenticatedNavigation()
      if (!navigated) {
        setIsLoading(false)
      }
    },
    [
      attemptCredentialSignIn,
      finalizeAuthenticatedNavigation,
      navigate,
      openMfaVerificationStep,
      pendingVerificationEmail,
      pendingVerificationPassword,
      redirectTarget,
    ],
  )

  const handleVerifyMfaTotp = useCallback(
    async (otp: string) => {
      const normalizedCode = otp.replace(/\D+/g, '').slice(0, 6)

      if (normalizedCode.length !== 6) {
        setError(m.auth_error_mfa_invalid_code())
        return
      }

      setIsLoading(true)
      setError('')

      const result = await authClient.twoFactor.verifyTotp({
        code: normalizedCode,
      })

      setIsLoading(false)

      if (result.error) {
        setError(
          readAuthErrorMessage(
            result.error,
            m.auth_error_mfa_invalid_or_expired(),
          ),
        )
        return
      }

      const navigated = await finalizeAuthenticatedNavigation()
      if (!navigated) {
        setIsLoading(false)
      }
    },
    [finalizeAuthenticatedNavigation],
  )

  const handleResendVerificationOtp = useCallback(async () => {
    if (!pendingVerificationEmail) {
      setError(m.auth_error_no_pending_email())
      return
    }

    setIsLoading(true)
    setError('')

    const result = await authClient.emailOtp.sendVerificationOtp({
      email: pendingVerificationEmail,
      type: 'email-verification',
    })

    setIsLoading(false)

    if (result.error) {
      setError(
        readAuthErrorMessage(
          result.error,
          m.auth_error_resend_verification_failed(),
        ),
      )
      return
    }

    setOtpSentAt(Date.now())
  }, [pendingVerificationEmail])

  const handleBackFromMfa = useCallback(() => {
    setView('auth-form')
    setPendingMfaEmail('')
    setError('')
  }, [])

  return {
    view,
    isSignUp,
    invitationEmail,
    invitationLookupLoading,
    pendingVerificationEmail,
    pendingMfaEmail,
    verificationMessage,
    otpSentAt,
    otpExpiresInSeconds: OTP_EXPIRES_IN_SECONDS,
    isLoading,
    error,
    clearError,
    handleToggleMode,
    handleShowForgotPassword,
    handleBackToLogin,
    handleAuthSubmit,
    handleVerifyEmailOtp,
    handleVerifyMfaTotp,
    handleResendVerificationOtp,
    handleBackFromMfa,
  }
}
