'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { m } from '@/paraglide/messages.js'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import { cardVariants, staggerChildVariants } from '@/lib/animations'
import { GoogleIcon, MicrosoftIcon } from '@/components/icons/provider-icons'
import {
  AUTH_PASSWORD_MIN_LENGTH,
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/components/auth/auth-shared'
import { authClient } from '@/lib/auth/auth-client'

export type LoginFormProps = {
  /** When true, shows sign-up fields (confirm password) and sign-up copy. */
  isSignUp?: boolean
  /** Pre-filled email to use for invitation-driven auth flows. */
  initialEmail?: string
  /** Prevent changing the invited email when the invitation already resolved. */
  isInvitationEmailLocked?: boolean
  /** Blocks submission until the invitation lookup finishes. */
  isInvitationLookupLoading?: boolean
  onToggleMode: () => void
  onSubmit: (email: string, password: string) => Promise<void>
  isLoading: boolean
  error: string
  onForgotPassword?: () => void
}

export function LoginForm({
  isSignUp = false,
  initialEmail,
  isInvitationEmailLocked = false,
  isInvitationLookupLoading = false,
  onToggleMode,
  onSubmit,
  isLoading: parentIsLoading,
  error: parentError,
  onForgotPassword,
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false)
  const isInteractionDisabled = parentIsLoading || isInvitationLookupLoading

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    try {
      await authClient.signIn.social(
        { provider: 'google' },
        {
          onError: (ctx) => {
            setEmailError(ctx.error?.message ?? m.auth_error_google())
            setIsGoogleLoading(false)
          },
        },
      )
    } catch {
      setIsGoogleLoading(false)
    }
  }

  const handleMicrosoftSignIn = async () => {
    setIsMicrosoftLoading(true)
    try {
      await authClient.signIn.social(
        { provider: 'microsoft' },
        {
          onError: (ctx) => {
            setEmailError(ctx.error?.message ?? m.auth_error_microsoft())
            setIsMicrosoftLoading(false)
          },
        },
      )
    } catch {
      setIsMicrosoftLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = normalizeEmailAddress(email)

    setEmailError('')
    setPasswordError('')
    setConfirmPasswordError('')

    if (!isValidEmailAddress(normalizedEmail)) {
      setEmailError(m.auth_error_invalid_email())
      return
    }

    if (isSignUp) {
      if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
        setPasswordError(m.auth_error_password_min_length({ count: String(AUTH_PASSWORD_MIN_LENGTH) }))
        return
      }
      if (password !== confirmPassword) {
        setConfirmPasswordError(m.auth_error_password_mismatch())
        return
      }
    }

    try {
      await onSubmit(normalizedEmail, password)
    } catch {
      const msg = isSignUp
        ? m.auth_error_sign_up_failed()
        : m.auth_error_invalid_credentials()
      setEmailError(msg)
      setPasswordError(msg)
      if (isSignUp) setConfirmPasswordError(msg)
    }
  }

  useEffect(() => {
    if (!parentError) return
    setEmailError((currentError) => currentError || parentError)
    setPasswordError((currentError) => currentError || parentError)
    if (isSignUp) {
      setConfirmPasswordError((currentError) => currentError || parentError)
    }
  }, [isSignUp, parentError])

  useEffect(() => {
    if (!initialEmail) return

    /**
     * Invitation lookups resolve asynchronously after the page loads. Sync the
     * local form state when the invited address arrives so browser autofill or
     * optimistic typing cannot drift away from the invitation recipient.
     */
    setEmail((currentEmail) => {
      const normalizedCurrentEmail = normalizeEmailAddress(currentEmail)
      const normalizedInitialEmail = normalizeEmailAddress(initialEmail)

      if (normalizedCurrentEmail === normalizedInitialEmail) {
        return currentEmail
      }

      return initialEmail
    })
    setEmailError('')
  }, [initialEmail])

  return (
    <motion.div
      className="overflow-hidden rounded-3xl bg-surface-strong/30 dark:bg-surface-strong/50 backdrop-blur-xl shadow-[0_0_1px_rgba(0,0,0,0.40),0_0_2px_rgba(0,0,0,0.05),0_10px_10px_rgba(0,0,0,0.25)] transition-colors duration-200"
      variants={cardVariants}
    >
      <div>
        <div className="rounded-b-3xl bg-surface-raised/70 dark:bg-surface-raised/60 backdrop-blur-sm p-8 shadow-[0_0_1px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.08)] transition-colors duration-200">
          <form
            onSubmit={handleSubmit}
            className="space-y-8 rounded-3xl"
            autoComplete="on"
          >
        <motion.div variants={staggerChildVariants} className="space-y-2 relative">
          <Label htmlFor="email" variant="muted">
            {m.auth_form_email_label()}
          </Label>
          <Input
            id="email"
            name="username"
            type="email"
            variant="alt"
            inputSize="large"
            placeholder={m.auth_form_email_placeholder()}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError('')
            }}
            disabled={isInteractionDisabled}
            readOnly={isInvitationEmailLocked}
            autoComplete={isSignUp ? 'section-sign-up email' : 'section-sign-in username'}
            aria-invalid={!!emailError}
            required
          />
          {isInvitationEmailLocked && (
            <p className="text-xs text-foreground-secondary">
              {m.auth_invitation_tied_to_email()}
            </p>
          )}
          <AnimatePresence>
            {emailError && (
              <motion.p
                className="absolute top-full left-0 text-red-500 dark:text-red-400 text-sm mt-1"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {emailError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={staggerChildVariants} className="space-y-2 relative">
          <Label htmlFor="password" variant="muted">
            {m.auth_form_password_label()}
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            variant="alt"
            inputSize="large"
            placeholder={isSignUp ? m.auth_form_create_password() : m.auth_form_password_placeholder()}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (passwordError) setPasswordError('')
            }}
            disabled={isInteractionDisabled}
            autoComplete={isSignUp ? 'section-sign-up new-password' : 'section-sign-in current-password'}
            aria-invalid={!!passwordError}
            showPasswordToggle
            required
          />
          <AnimatePresence>
            {passwordError && (
              <motion.p
                className="absolute top-full left-0 text-red-500 dark:text-red-400 text-sm mt-1"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {passwordError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {isSignUp && (
            <motion.div
              key="confirm-password"
              variants={staggerChildVariants}
              className="overflow-hidden"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
              exit={{ opacity: 0, height: 0, marginTop: -32 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="space-y-2 relative">
                <Label htmlFor="confirmPassword" variant="muted">
                  {m.auth_form_confirm_password()}
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirm-password"
                  type="password"
                  variant="alt"
                  inputSize="large"
                  placeholder={m.auth_form_confirm_password_placeholder()}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (confirmPasswordError) setConfirmPasswordError('')
                  }}
                  disabled={isInteractionDisabled}
                  autoComplete="section-sign-up new-password"
                  aria-invalid={!!confirmPasswordError}
                  showPasswordToggle
                  required={isSignUp}
                />
                <AnimatePresence>
                  {confirmPasswordError && (
                    <motion.p
                      className="absolute top-full left-0 text-red-500 dark:text-red-400 text-sm mt-1"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      {confirmPasswordError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          variants={staggerChildVariants}
          className="flex items-center justify-between text-sm mt-8"
        >
          <div />
          <AnimatePresence>
            {!isSignUp && onForgotPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="overflow-hidden"
              >
                <Button type="button" variant="link" onClick={onForgotPassword}>
                  {m.auth_login_forgot_password()}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={staggerChildVariants}>
          <Button
            type="submit"
            variant="primaryAlt"
            size="big"
            disabled={isInteractionDisabled}
          >
            {parentIsLoading
              ? m.auth_login_submitting()
              : isSignUp
                ? m.auth_login_create_account()
                : m.auth_login_sign_in()}
          </Button>
        </motion.div>
          </form>

          <motion.div
            variants={staggerChildVariants}
            className="my-6 flex items-center gap-3"
          >
            <div className="h-px flex-1 bg-border-base" />
            <span className="text-sm text-foreground-secondary">{m.auth_login_divider()}</span>
            <div className="h-px flex-1 bg-border-base" />
          </motion.div>

          <motion.div variants={staggerChildVariants} className="space-y-3">
            <Button
              type="button"
              variant="outline"
              size="big"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isMicrosoftLoading || isInteractionDisabled}
            >
              <GoogleIcon className="mr-2.5 size-5" />
              {isGoogleLoading
                ? (isSignUp ? m.auth_login_submitting_google_sign_up() : m.auth_login_submitting_google())
                : (isSignUp ? m.auth_login_sign_up_google() : m.auth_login_sign_in_google())}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="big"
              onClick={handleMicrosoftSignIn}
              disabled={isMicrosoftLoading || isGoogleLoading || isInteractionDisabled}
            >
              <MicrosoftIcon className="mr-2.5 size-5" />
              {isMicrosoftLoading
                ? (isSignUp ? m.auth_login_submitting_microsoft_sign_up() : m.auth_login_submitting_microsoft())
                : (isSignUp ? m.auth_login_sign_up_microsoft() : m.auth_login_sign_in_microsoft())}
            </Button>
          </motion.div>
        </div>
      </div>

      <motion.div
        variants={staggerChildVariants}
        className="flex items-center justify-center px-8 py-4 transition-colors duration-200"
      >
        <p className="text-center text-sm text-foreground-tertiary">
          {isSignUp ? (
            <>
              {m.auth_form_already_have_account()}{' '}
              <Button type="button" onClick={onToggleMode} variant="link">
                {m.auth_login_sign_in()}
              </Button>
            </>
          ) : (
            <>
              {m.auth_form_no_account()}{' '}
              <Button type="button" onClick={onToggleMode} variant="link">
                {m.auth_login_sign_up()}
              </Button>
            </>
          )}
        </p>
      </motion.div>
    </motion.div>
  )
}
