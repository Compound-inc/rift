'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { m } from '@/paraglide/messages.js'
import { Button } from '@rift/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@rift/ui/input-otp'
import { Label } from '@rift/ui/label'
import { cn } from '@rift/utils'
import {
  cardVariants,
  menuCardButtonVariants,
  menuCardContainerVariants,
  menuCardContentVariants,
  menuCardHeaderVariants,
  staggerChildVariants,
} from '@/lib/animations'

export type OtpStepProps = {
  title: ReactNode
  description: ReactNode
  instruction: ReactNode
  message?: ReactNode
  label?: ReactNode
  submitText: ReactNode
  resendText?: ReactNode
  backText?: ReactNode
  formId?: string
  initialOtp?: string
  otpSentAt?: number | null
  otpExpiresInSeconds?: number
  error?: string
  isLoading: boolean
  onClearError?: () => void
  onSubmit: (otp: string) => Promise<void>
  onResend?: () => Promise<void>
  onBack?: () => void
}

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

/**
 * Shared auth-surface OTP step used by login-related flows that require
 * entering a 6-digit code, such as email verification and password recovery.
 */
export function OtpStep({
  title,
  description,
  instruction,
  message,
  label = m.auth_otp_label(),
  submitText,
  resendText,
  backText,
  formId = 'otp-step-form',
  initialOtp = '',
  otpSentAt = null,
  otpExpiresInSeconds,
  error = '',
  isLoading,
  onClearError,
  onSubmit,
  onResend,
  onBack,
}: OtpStepProps) {
  const [otp, setOtp] = useState(initialOtp)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const hasError = Boolean(error)

  useEffect(() => {
    setOtp(initialOtp)
  }, [initialOtp])

  useEffect(() => {
    if (otpSentAt == null || otpExpiresInSeconds == null) {
      setRemainingSeconds(null)
      return
    }

    const tick = () => {
      const elapsed = (Date.now() - otpSentAt) / 1000
      const remaining = Math.max(0, Math.ceil(otpExpiresInSeconds - elapsed))
      setRemainingSeconds(remaining)
    }

    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [otpExpiresInSeconds, otpSentAt])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit(otp.trim())
  }

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center w-full max-w-5xl mx-auto px-4"
      variants={menuCardContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div className="text-center mb-8" variants={menuCardHeaderVariants}>
        <h1 className="text-3xl font-bold text-black dark:text-white mb-4">{title}</h1>
        <p className="text-black/70 dark:text-white/60 text-lg mb-6">{description}</p>
      </motion.div>

      <motion.div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-surface-strong/30 dark:bg-surface-strong/50 backdrop-blur-xl shadow-[0_0_1px_rgba(0,0,0,0.40),0_0_2px_rgba(0,0,0,0.05),0_10px_10px_rgba(0,0,0,0.25)] transition-colors duration-200"
        variants={menuCardContentVariants}
      >
        <div className="rounded-b-3xl bg-surface-raised/70 dark:bg-surface-raised/60 backdrop-blur-sm p-8 shadow-[0_0_1px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.08)] transition-colors duration-200">
          <motion.form
            id={formId}
            onSubmit={handleSubmit}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            <motion.div variants={staggerChildVariants}>
              <p className="text-sm text-foreground-tertiary">{instruction}</p>
            </motion.div>

            {message ? (
              <motion.div variants={staggerChildVariants}>
                <p className="text-sm text-foreground-secondary">{message}</p>
              </motion.div>
            ) : null}

            <motion.div variants={staggerChildVariants} className="flex flex-col items-center space-y-4">
              <Label htmlFor={`${formId}-otp`} className="block text-center">
                {label}
              </Label>
              <InputOTP
                id={`${formId}-otp`}
                name={`${formId}-otp`}
                containerClassName="mx-auto justify-center"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(value) => {
                  if (hasError) onClearError?.()
                  setOtp(value.replace(/\D+/g, '').slice(0, 6))
                }}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      aria-invalid={hasError}
                      className={cn(
                        hasError &&
                          'border-red-500 bg-red-50/50 dark:border-red-400 dark:bg-red-900/20',
                      )}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              {remainingSeconds != null ? (
                <p className="text-center text-sm text-foreground-secondary">
                  {remainingSeconds > 0
                    ? m.auth_otp_expires_in({ time: formatRemaining(remainingSeconds) })
                    : m.auth_otp_expired()}
                </p>
              ) : null}
            </motion.div>
          </motion.form>
        </div>

        <motion.div
          variants={menuCardButtonVariants}
          className="flex items-center justify-end gap-3 px-8 py-4 transition-colors duration-200"
        >
          {onBack ? (
            <Button type="button" variant="ghost" size="large" onClick={onBack} disabled={isLoading}>
              {backText ?? m.auth_otp_back_default()}
            </Button>
          ) : null}

          {onResend ? (
            <Button type="button" variant="ghost" size="large" onClick={onResend} disabled={isLoading}>
              {resendText ?? m.auth_otp_resend_default()}
            </Button>
          ) : null}

          <Button type="submit" variant="default" size="large" form={formId} disabled={otp.trim().length !== 6 || isLoading}>
            {submitText}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
