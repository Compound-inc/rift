import { Resend } from 'resend'
import {
  auth_mail_action_email_verification,
  auth_mail_action_forget_password,
  auth_mail_action_sign_in,
  auth_mail_subject_email_verification,
  auth_mail_subject_forget_password,
  auth_mail_subject_invitation,
  auth_mail_subject_sign_in,
} from '@/paraglide/messages'
import {
  buildAuthActionLinkTemplate,
  buildOrganizationInvitationTemplate,
  buildOtpEmailTemplate,
} from '@/lib/backend/auth/services/auth-email.templates'
import type { OtpEmailKind } from '@/lib/backend/auth/services/auth-email.templates'
import { resolveAccountLocale } from '@/lib/backend/auth/services/auth-locale.service'

function requireEmailEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`)
  }
  return value
}

const resendClient = new Resend(requireEmailEnv('RESEND_API_KEY'))
const fromAddress = requireEmailEnv('RESEND_FROM_EMAIL')

export type SendAuthEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendAuthEmail(input: SendAuthEmailInput): Promise<void> {
  await resendClient.emails.send({
    from: fromAddress,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}

const OTP_KINDS = new Set<OtpEmailKind>(['email-verification', 'forget-password', 'sign-in'])

export async function sendAuthOtpEmail(input: {
  to: string
  otp: string
  kind: string
  expiresInMinutes: number
  userId?: string | null
  fallbackAcceptLanguageHeader?: string | null
}): Promise<void> {
  const locale = await resolveAccountLocale({
    userId: input.userId,
    fallbackAcceptLanguageHeader: input.fallbackAcceptLanguageHeader,
  })
  const otpKind = (OTP_KINDS.has(input.kind as OtpEmailKind)
    ? input.kind
    : 'sign-in') as OtpEmailKind
  const subjectByKind: Record<OtpEmailKind, string> = {
    'email-verification': auth_mail_subject_email_verification({}, { locale }),
    'forget-password': auth_mail_subject_forget_password({}, { locale }),
    'sign-in': auth_mail_subject_sign_in({}, { locale }),
  }
  const actionByKind: Record<OtpEmailKind, string> = {
    'email-verification': auth_mail_action_email_verification({}, { locale }),
    'forget-password': auth_mail_action_forget_password({}, { locale }),
    'sign-in': auth_mail_action_sign_in({}, { locale }),
  }
  const subject = subjectByKind[otpKind] ?? subjectByKind['sign-in']
  const actionLabel = actionByKind[otpKind] ?? actionByKind['sign-in']
  const template = buildOtpEmailTemplate({
    locale,
    code: input.otp,
    actionLabel,
    expiresInMinutes: input.expiresInMinutes,
  })

  await sendAuthEmail({
    to: input.to,
    subject,
    text: template.text,
    html: template.html,
  })
}

export async function sendOrganizationInvitationEmail(input: {
  to: string
  inviteLink: string
  inviterName: string
  organizationName: string
  userId?: string | null
  fallbackAcceptLanguageHeader?: string | null
}): Promise<void> {
  const locale = await resolveAccountLocale({
    userId: input.userId,
    fallbackAcceptLanguageHeader: input.fallbackAcceptLanguageHeader,
  })
  const template = buildOrganizationInvitationTemplate({
    locale,
    inviteLink: input.inviteLink,
    inviterName: input.inviterName,
    organizationName: input.organizationName,
  })

  const subject = auth_mail_subject_invitation(
    { organizationName: input.organizationName },
    { locale },
  )

  await sendAuthEmail({
    to: input.to,
    subject,
    text: template.text,
    html: template.html,
  })
}

export async function sendAuthVerificationLinkEmail(input: {
  to: string
  verifyUrl: string
  userId?: string | null
  fallbackAcceptLanguageHeader?: string | null
}): Promise<void> {
  const locale = await resolveAccountLocale({
    userId: input.userId,
    fallbackAcceptLanguageHeader: input.fallbackAcceptLanguageHeader,
  })
  const subject = auth_mail_subject_email_verification({}, { locale })
  const actionLabel = auth_mail_action_email_verification({}, { locale })
  const template = buildAuthActionLinkTemplate({
    locale,
    actionLabel,
    actionUrl: input.verifyUrl.trim(),
    subjectLine: subject,
  })

  await sendAuthEmail({
    to: input.to,
    subject,
    text: template.text,
    html: template.html,
  })
}
