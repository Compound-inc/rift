import {
  auth_mail_invitation_accept,
  auth_mail_invitation_body,
  auth_mail_invitation_inviter_label,
  auth_mail_invitation_open_link,
  auth_mail_invitation_preheader,
  auth_mail_invitation_subtitle,
  auth_mail_invitation_title,
  auth_mail_invitation_workspace_label,
  auth_mail_otp_code_label,
  auth_mail_otp_expires_in,
  auth_mail_otp_ignore,
  auth_mail_otp_preheader,
  auth_mail_otp_subtitle,
} from '@/paraglide/messages'
import type { SupportedAuthLocale } from '@/lib/backend/auth/domain/auth-locale'

type AuthEmailTemplate = {
  html: string
  text: string
}

type AuthEmailLayoutInput = {
  preheader: string
  title: string
  subtitle: string
  sections: string[]
  textSections: string[]
  cta?: {
    label: string
    href: string
  }
}

export type OtpEmailKind = 'email-verification' | 'forget-password' | 'sign-in'

export type BuildOtpEmailTemplateInput = {
  locale: SupportedAuthLocale
  code: string
  actionLabel: string
  expiresInMinutes: number
}

export type BuildOrganizationInvitationTemplateInput = {
  locale: SupportedAuthLocale
  inviteLink: string
  inviterName: string
  organizationName: string
}

export type BuildAuthActionLinkTemplateInput = {
  locale: SupportedAuthLocale
  actionLabel: string
  actionUrl: string
  subjectLine: string
}

const EMAIL_BRAND_NAME = 'Rift'
const EMAIL_BACKGROUND = 'transparent'
const EMAIL_SURFACE = '#ffffff'
const EMAIL_TEXT_PRIMARY = '#18181b'
const EMAIL_TEXT_SECONDARY = '#52525b'
const EMAIL_ACCENT = '#111827'
const EMAIL_BORDER = '#e4e4e7'

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildEmailLayout(input: AuthEmailLayoutInput): AuthEmailTemplate {
  const ctaHtml = input.cta
    ? `
      <tr>
        <td style="padding: 8px 0 4px;">
          <a
            href="${escapeHtml(input.cta.href)}"
            style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;"
          >
            ${escapeHtml(input.cta.label)}
          </a>
        </td>
      </tr>
    `
    : ''

  const bodySectionsHtml = input.sections
    .map((section) => `<tr><td style="padding: 8px 0;">${section}</td></tr>`)
    .join('')
  const ctaText = input.cta ? `\n\n${input.cta.label}: ${input.cta.href}` : ''
  const text =
    [input.title, input.subtitle, ...input.textSections].join('\n\n') + ctaText

  return {
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_BACKGROUND};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${EMAIL_TEXT_PRIMARY};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(input.preheader)}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${EMAIL_BACKGROUND};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:${EMAIL_SURFACE};border:1px solid ${EMAIL_BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px;border-bottom:1px solid ${EMAIL_BORDER};font-weight:700;letter-spacing:0.2px;">
                ${EMAIL_BRAND_NAME}
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:22px;line-height:30px;font-weight:700;color:${EMAIL_TEXT_PRIMARY};padding-bottom:8px;">
                      ${escapeHtml(input.title)}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;line-height:24px;color:${EMAIL_TEXT_SECONDARY};padding-bottom:4px;">
                      ${escapeHtml(input.subtitle)}
                    </td>
                  </tr>
                  ${bodySectionsHtml}
                  ${ctaHtml}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text,
  }
}

export function buildOtpEmailTemplate(
  input: BuildOtpEmailTemplateInput,
): AuthEmailTemplate {
  const codeCells = input.code
    .split('')
    .map(
      (digit) =>
        `<td align="center" style="border:1px solid ${EMAIL_BORDER};border-radius:8px;padding:10px 12px;font-size:24px;line-height:28px;font-weight:700;min-width:24px;">${escapeHtml(digit)}</td>`,
    )
    .join('<td style="width:8px;"></td>')

  return buildEmailLayout({
    preheader: auth_mail_otp_preheader(
      { code: input.code },
      { locale: input.locale },
    ),
    title: 'Your security code',
    subtitle: auth_mail_otp_subtitle(
      { actionLabel: input.actionLabel },
      { locale: input.locale },
    ),
    sections: [
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 10px;"><tr>${codeCells}</tr></table>`,
      `<p style="margin:0;color:${EMAIL_TEXT_SECONDARY};font-size:14px;line-height:22px;">${escapeHtml(auth_mail_otp_expires_in({ minutes: String(input.expiresInMinutes) }, { locale: input.locale }))}</p>`,
      `<p style="margin:0;color:${EMAIL_TEXT_SECONDARY};font-size:14px;line-height:22px;">${escapeHtml(auth_mail_otp_ignore({}, { locale: input.locale }))}</p>`,
    ],
    textSections: [
      `${auth_mail_otp_code_label({}, { locale: input.locale })}: ${input.code}`,
      auth_mail_otp_subtitle(
        { actionLabel: input.actionLabel },
        { locale: input.locale },
      ),
      auth_mail_otp_expires_in(
        { minutes: String(input.expiresInMinutes) },
        { locale: input.locale },
      ),
      auth_mail_otp_ignore({}, { locale: input.locale }),
    ],
  })
}

export function buildOrganizationInvitationTemplate(
  input: BuildOrganizationInvitationTemplateInput,
): AuthEmailTemplate {
  const inviter = escapeHtml(input.inviterName)
  const organization = escapeHtml(input.organizationName)

  return buildEmailLayout({
    preheader: auth_mail_invitation_preheader(
      {
        inviterName: input.inviterName,
        organizationName: input.organizationName,
      },
      { locale: input.locale },
    ),
    title: auth_mail_invitation_title(
      { organizationName: input.organizationName },
      { locale: input.locale },
    ),
    subtitle: auth_mail_invitation_subtitle(
      {
        inviterName: input.inviterName,
        organizationName: input.organizationName,
      },
      { locale: input.locale },
    ),
    sections: [
      `<p style="margin:0;color:${EMAIL_TEXT_SECONDARY};font-size:14px;line-height:22px;">${escapeHtml(auth_mail_invitation_body({}, { locale: input.locale }))}</p>`,
      `<p style="margin:0;color:${EMAIL_TEXT_SECONDARY};font-size:14px;line-height:22px;"><strong>${escapeHtml(auth_mail_invitation_inviter_label({}, { locale: input.locale }))}:</strong> ${inviter}<br /><strong>${escapeHtml(auth_mail_invitation_workspace_label({}, { locale: input.locale }))}:</strong> ${organization}</p>`,
    ],
    textSections: [
      auth_mail_invitation_preheader(
        {
          inviterName: input.inviterName,
          organizationName: input.organizationName,
        },
        { locale: input.locale },
      ),
      auth_mail_invitation_open_link(
        { inviteLink: input.inviteLink },
        { locale: input.locale },
      ),
    ],
    cta: {
      label: auth_mail_invitation_accept({}, { locale: input.locale }),
      href: input.inviteLink,
    },
  })
}

export function buildAuthActionLinkTemplate(
  input: BuildAuthActionLinkTemplateInput,
): AuthEmailTemplate {
  const subtitle = auth_mail_otp_subtitle(
    { actionLabel: input.actionLabel },
    { locale: input.locale },
  )
  const ignoreMessage = auth_mail_otp_ignore({}, { locale: input.locale })

  return buildEmailLayout({
    preheader: subtitle,
    title: input.subjectLine,
    subtitle,
    sections: [
      `<p style="margin:0;color:${EMAIL_TEXT_SECONDARY};font-size:14px;line-height:22px;">${escapeHtml(ignoreMessage)}</p>`,
    ],
    textSections: [subtitle, ignoreMessage],
    cta: {
      label: input.actionLabel,
      href: input.actionUrl,
    },
  })
}
