'use client'

import { motion } from 'motion/react'
import { m } from '@/paraglide/messages.js'
import { Button } from '@rift/ui/button'
import { Label } from '@rift/ui/label'
import { Input } from '@rift/ui/input'
import {
  cardVariants,
  staggerChildVariants,
  menuCardContainerVariants,
  menuCardHeaderVariants,
  menuCardButtonVariants,
  menuCardContentVariants,
} from '@/lib/animations'
import { OtpStep } from '@/components/auth/otp-step'
import { useForgotPasswordLogic } from './forgot-password.logic'

export type ForgotPasswordProps = {
  redirectTarget: string
  onBackToLogin: () => void
}

export function ForgotPassword({ redirectTarget, onBackToLogin }: ForgotPasswordProps) {
  const {
    email,
    setEmail,
    otp,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    otpSentAt,
    step,
    setStep,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    isLoading,
    otpExpiresInSeconds,
    handleEmailSubmit,
    handleOtpSubmit,
    handleResendOtp,
    handlePasswordReset,
  } = useForgotPasswordLogic(redirectTarget)

  if (step === 'enter-otp') {
    return (
      <OtpStep
        title={m.auth_forgot_password_otp_title()}
        description={m.auth_forgot_password_otp_description()}
        instruction={m.auth_forgot_password_otp_instruction({ email })}
        formId="forgot-password-otp-form"
        initialOtp={otp}
        otpSentAt={otpSentAt}
        otpExpiresInSeconds={otpExpiresInSeconds}
        error={error}
        isLoading={isLoading}
        onClearError={() => setError('')}
        onSubmit={handleOtpSubmit}
        onResend={handleResendOtp}
        onBack={() => {
          setError('')
          setStep('request-email')
        }}
        submitText={m.auth_forgot_password_otp_submit()}
        resendText={m.auth_forgot_password_otp_resend()}
        backText={m.auth_forgot_password_otp_back()}
      />
    )
  }

  const isRequestStep = step === 'request-email'
  const title = isRequestStep ? m.auth_forgot_password_restore_title() : m.auth_forgot_password_new_title()
  const description = isRequestStep
    ? m.auth_forgot_password_restore_description()
    : m.auth_forgot_password_new_description()

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center w-full max-w-5xl mx-auto px-4"
      variants={menuCardContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="text-center mb-8"
        variants={menuCardHeaderVariants}
      >
        <h1 className="text-3xl font-bold text-black dark:text-white mb-4">{title}</h1>
        <p className="text-black/70 dark:text-white/60 text-lg mb-6">{description}</p>
      </motion.div>

      <motion.div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-surface-strong/30 dark:bg-surface-strong/50 backdrop-blur-xl shadow-[0_0_1px_rgba(0,0,0,0.40),0_0_2px_rgba(0,0,0,0.05),0_10px_10px_rgba(0,0,0,0.25)] transition-colors duration-200"
        variants={menuCardContentVariants}
      >
        <div className="rounded-b-3xl bg-surface-raised/70 dark:bg-surface-raised/60 backdrop-blur-sm p-8 shadow-[0_0_1px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.08)] transition-colors duration-200">
          <motion.form
            id="forgot-password-form"
            onSubmit={isRequestStep ? handleEmailSubmit : handlePasswordReset}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {isRequestStep ? (
              <motion.div variants={staggerChildVariants} className="space-y-2 relative">
                <Label htmlFor="forgot-email" variant="muted">
                  {m.auth_forgot_password_email_label()}
                </Label>
                <Input
                  id="forgot-email"
                  name="email"
                  type="email"
                  variant="alt"
                  inputSize="large"
                  placeholder={m.auth_forgot_password_email_placeholder()}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (error) setError('')
                    if (successMessage) setSuccessMessage('')
                  }}
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </motion.div>
            ) : (
              <>
                <motion.div variants={staggerChildVariants}>
                  <p className="text-sm text-foreground-tertiary">
                    {m.auth_forgot_password_we_will_update({ email })}
                  </p>
                </motion.div>

                <motion.div variants={staggerChildVariants} className="space-y-2 relative">
                  <Label htmlFor="forgot-password-new-password" variant="muted">
                    {m.auth_forgot_password_new_label()}
                  </Label>
                  <Input
                    id="forgot-password-new-password"
                    name="forgot-password-new-password"
                    type="password"
                    autoComplete="new-password"
                    variant="alt"
                    inputSize="large"
                    placeholder={m.auth_forgot_password_new_placeholder()}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value)
                      if (error) setError('')
                    }}
                    showPasswordToggle
                    disabled={isLoading}
                    required
                  />
                </motion.div>

                <motion.div variants={staggerChildVariants} className="space-y-2 relative">
                  <Label htmlFor="forgot-password-confirm-password" variant="muted">
                    {m.auth_forgot_password_confirm_label()}
                  </Label>
                  <Input
                    id="forgot-password-confirm-password"
                    name="forgot-password-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    variant="alt"
                    inputSize="large"
                    placeholder={m.auth_forgot_password_confirm_placeholder()}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      if (error) setError('')
                    }}
                    showPasswordToggle
                    disabled={isLoading}
                    required
                  />
                </motion.div>
              </>
            )}

            {error ? (
              <motion.p
                variants={staggerChildVariants}
                className="rounded-2xl border border-foreground-error/20 bg-foreground-error/10 px-4 py-3 text-sm text-foreground-error"
                role="alert"
              >
                {error}
              </motion.p>
            ) : null}

            {successMessage ? (
              <motion.p
                variants={staggerChildVariants}
                className="rounded-2xl border border-foreground-info/20 bg-foreground-info/10 px-4 py-3 text-sm text-foreground-info"
                role="status"
                aria-live="polite"
              >
                {successMessage}
              </motion.p>
            ) : null}
          </motion.form>
        </div>

        <motion.div
          variants={menuCardButtonVariants}
          className="flex items-center justify-end gap-3 px-8 py-4 transition-colors duration-200"
        >
          <Button
            type="button"
            variant="ghost"
            size="large"
            onClick={
              isRequestStep
                ? onBackToLogin
                : () => {
                    setError('')
                    setStep('enter-otp')
                  }
            }
            disabled={isLoading}
          >
            {m.auth_forgot_password_back()}
          </Button>
          <Button
            type="submit"
            variant="default"
            size="large"
            form="forgot-password-form"
            disabled={
              !email ||
              isLoading ||
              (!isRequestStep && (!newPassword || !confirmPassword))
            }
          >
            {isRequestStep ? m.auth_forgot_password_send_code() : m.auth_forgot_password_update()}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
