'use client'

import { AnimatePresence, motion } from 'motion/react'
import { m } from '@/paraglide/messages.js'
import { useSignInPageLogic } from './sign-in-page.logic'
import { LoginHeader } from './login-header'
import { LoginForm } from './login-form'
import { LegalLinks } from './legal-links'
import { ForgotPassword } from '@/components/auth/forgot-password'
import { OtpStep } from '@/components/auth/otp-step'
import { menuCardContainerVariants } from '@/lib/shared/animations'

export type SignInPageProps = {
  redirectTarget: string
  initialMode?: 'sign-in' | 'sign-up'
  invitationId?: string
}

/**
 * Combined auth surface for sign-in, sign-up, account recovery, and
 * verification steps that may happen before a session is fully established.
 */
export function SignInPage({
  redirectTarget,
  initialMode = 'sign-in',
  invitationId,
}: SignInPageProps) {
  const {
    view,
    isSignUp,
    invitationEmail,
    invitationLookupLoading,
    pendingVerificationEmail,
    pendingMfaEmail,
    verificationMessage,
    otpSentAt,
    otpExpiresInSeconds,
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
  } = useSignInPageLogic(redirectTarget, initialMode, invitationId)

  const authModeFormKey = isSignUp ? 'sign-up' : 'sign-in'

  return (
    <div className="relative grid w-full place-items-center">
      <AnimatePresence initial={false}>
        {view === 'forgot-password' ? (
          <ForgotPassword
            key="forgot-password"
            redirectTarget={redirectTarget}
            onBackToLogin={handleBackToLogin}
          />
        ) : view === 'email-verification' ? (
          <OtpStep
            key="email-verification"
            title={m.auth_email_verification_title()}
            description={m.auth_email_verification_description()}
            instruction={m.auth_email_verification_instruction({
              email: pendingVerificationEmail,
            })}
            message={verificationMessage}
            formId="email-verification-form"
            otpSentAt={otpSentAt}
            otpExpiresInSeconds={otpExpiresInSeconds}
            error={error}
            isLoading={isLoading}
            onClearError={clearError}
            onSubmit={handleVerifyEmailOtp}
            onResend={handleResendVerificationOtp}
            submitText={m.auth_email_verification_submit()}
            resendText={m.auth_email_verification_resend()}
          />
        ) : view === 'mfa-verification' ? (
          <OtpStep
            key="mfa-verification"
            title={m.auth_mfa_title()}
            description={m.auth_mfa_description()}
            instruction={m.auth_mfa_instruction({ email: pendingMfaEmail })}
            formId="mfa-verification-form"
            error={error}
            isLoading={isLoading}
            onClearError={clearError}
            onSubmit={handleVerifyMfaTotp}
            onBack={handleBackFromMfa}
            submitText={m.auth_mfa_submit()}
            backText={m.auth_mfa_back()}
          />
        ) : (
          <motion.div
            key={`login-form-${authModeFormKey}`}
            className="col-start-1 row-start-1 relative z-10 w-full max-w-md"
            variants={menuCardContainerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            <LoginHeader isSignUp={isSignUp} />
            <LoginForm
              key={`auth-form-${authModeFormKey}`}
              isSignUp={isSignUp}
              onToggleMode={handleToggleMode}
              onSubmit={handleAuthSubmit}
              isLoading={isLoading}
              initialEmail={invitationEmail}
              isInvitationEmailLocked={!!invitationEmail}
              isInvitationLookupLoading={invitationLookupLoading}
              error={error}
              onForgotPassword={handleShowForgotPassword}
            />
            <LegalLinks isSignUp={isSignUp} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
