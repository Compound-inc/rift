import { betterAuth } from 'better-auth'
import { emailOTP } from 'better-auth/plugins'
import { anonymous } from 'better-auth/plugins/anonymous'
import { multiSession } from 'better-auth/plugins/multi-session'
import { organization } from 'better-auth/plugins/organization'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { Pool } from 'pg'
import { sendAuthEmail } from './auth-email.server'

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}.`,
    )
  }
  return value
}

function resolveAuthBaseURL(): string {
  const raw = process.env.BETTER_AUTH_URL?.trim()
  if (!raw) {
    throw new Error(
      'Missing BETTER_AUTH_URL. Configure apps/start/.env before starting auth.',
    )
  }
  return raw.replace(/\/+$/, '')
}

const connectionString = requireEnv('ZERO_UPSTREAM_DB')
export const authPool = new Pool({ connectionString })
const authBaseURL = resolveAuthBaseURL()

export const auth = betterAuth({
  appName: 'Rift',
  baseURL: authBaseURL,
  basePath: '/api/auth',
  secret: requireEnv('BETTER_AUTH_SECRET'),
  database: authPool,
  trustedOrigins: [authBaseURL],
  user: {
    changeEmail: {
      enabled: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
  },
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      otpLength: 6,
      expiresIn: 5 * 60,
      allowedAttempts: 5,
      storeOTP: 'hashed',
      async sendVerificationOTP({ email, otp, type }) {
        const subjectByType: Record<string, string> = {
          'email-verification': 'Verify your email',
          'forget-password': 'Reset your password',
          'sign-in': 'Your sign-in code',
        }

        const actionByType: Record<string, string> = {
          'email-verification': 'verify your email',
          'forget-password': 'reset your password',
          'sign-in': 'sign in',
        }

        void sendAuthEmail({
          to: email,
          subject: subjectByType[type] ?? 'Your verification code',
          text: `Your Rift code is ${otp}. Enter it in the app to ${actionByType[type] ?? 'continue'}. This code expires in 5 minutes.`,
        }).catch((error) => {
          console.error(`Failed to send ${type} OTP`, error)
        })
      },
    }),
    organization({
      allowUserToCreateOrganization: true,
      requireEmailVerificationOnInvitation: true,
      sendInvitationEmail: async (data) => {
        const inviteLink = `${authBaseURL}/auth/accept-invitation/${data.id}`
        const inviterName = data.inviter?.user?.name ?? data.inviter?.user?.email ?? 'A team member'
        const orgName = data.organization?.name ?? 'the organization'
        void sendAuthEmail({
          to: data.email,
          subject: `You're invited to join ${orgName}`,
          text: `${inviterName} invited you to join ${orgName}. Open this link to accept: ${inviteLink}`,
        }).catch((error) => {
          console.error('Failed to send organization invitation email', error)
        })
      },
    }),
    anonymous({
      generateName: () => 'Guest User',
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        // Reassign app-owned rows so guest chat history survives account upgrade.
        const fromUserId = anonymousUser.user.id
        const toUserId = newUser.user.id
        const client = await authPool.connect()

        try {
          await client.query('BEGIN')
          await client.query('UPDATE threads SET user_id = $1 WHERE user_id = $2', [
            toUserId,
            fromUserId,
          ])
          await client.query('UPDATE messages SET user_id = $1 WHERE user_id = $2', [
            toUserId,
            fromUserId,
          ])
          await client.query('UPDATE attachments SET user_id = $1 WHERE user_id = $2', [
            toUserId,
            fromUserId,
          ])
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }
      },
    }),
    multiSession({
      /**
       * Allow users to stay signed in from multiple devices/browsers
       * while still being able to revoke specific sessions from settings.
       */
      maximumSessions: 10,
    }),
    twoFactor({
      issuer: 'Rift',
      totpOptions: {
        digits: 6,
        period: 30,
      },
      backupCodeOptions: {
        amount: 10,
        length: 10,
        storeBackupCodes: 'encrypted',
      },
      twoFactorCookieMaxAge: 10 * 60,
      trustDeviceMaxAge: 30 * 24 * 60 * 60,
    }),
    tanstackStartCookies(),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
})
