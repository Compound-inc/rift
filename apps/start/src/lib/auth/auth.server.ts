import { Effect } from 'effect'
import { betterAuth } from 'better-auth'
import { stripe } from '@better-auth/stripe'
import { emailOTP, testUtils } from 'better-auth/plugins'
import { anonymous } from 'better-auth/plugins/anonymous'
import { multiSession } from 'better-auth/plugins/multi-session'
import { organization } from 'better-auth/plugins/organization'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import Stripe from 'stripe'
import {
  isStripeManagedWorkspacePlan,
  WORKSPACE_PLANS,
  resolveStripePlanPriceId,
} from '@/lib/billing/plan-catalog'
import { WorkspaceBillingRuntime } from '@/lib/billing-backend/runtime/workspace-billing-runtime'
import {
  type OrgSeatAvailability,
  toInvitationSeatLimitApiError,
  WorkspaceBillingService,
} from '@/lib/billing-backend/services/workspace-billing.service'
import { isAdminRole } from './roles'
import { authPool } from './auth-pool'
import {
  buildDefaultOrganizationName,
  ensureMemberAccessRecord,
  ensureOrganizationBillingBaseline,
  findFirstOrganizationForUser,
  shouldProvisionDefaultOrganization,
  slugifyOrganizationName,
} from './default-organization'
import { sendAuthEmail } from './auth-email.server'
import type { Subscription as BetterAuthStripeSubscription } from '@better-auth/stripe'

async function runWorkspaceBilling<T>(
  callback: (service: typeof WorkspaceBillingService.Service) => Effect.Effect<T, any, never>,
): Promise<T> {
  return WorkspaceBillingRuntime.run(
    Effect.gen(function* () {
      const service = yield* WorkspaceBillingService
      return yield* callback(service)
    }),
  )
}

async function recomputeOrgEntitlementSnapshot(
  organizationId: string,
): Promise<OrgSeatAvailability> {
  return runWorkspaceBilling((service) =>
    service.recomputeEntitlementSnapshot({
      organizationId,
    }))
}

async function syncWorkspaceSubscription(input: {
  subscription: BetterAuthStripeSubscription
  stripeSubscription?: Stripe.Subscription
  billingProvider?: 'stripe' | 'manual'
}): Promise<void> {
  await runWorkspaceBilling((service) => service.syncWorkspaceSubscription(input))
}

async function markWorkspaceSubscriptionCanceled(input: {
  id: string
  plan: string
  referenceId: string
  status: BetterAuthStripeSubscription['status']
  cancelAtPeriodEnd?: boolean
}): Promise<void> {
  await runWorkspaceBilling((service) =>
    service.markWorkspaceSubscriptionCanceled({
      subscription: input,
    }))
}

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

const authBaseURL = resolveAuthBaseURL()
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
const isTestRuntime = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

function buildOrganizationSlug(input: { name: string; userId: string }): string {
  const base = slugifyOrganizationName(input.name) || 'workspace'
  return `${base}-${input.userId.slice(0, 8)}`
}

const stripePlugin
  = stripeSecretKey && stripeWebhookSecret
    ? stripe({
        stripeClient: new Stripe(stripeSecretKey),
        stripeWebhookSecret,
        organization: {
          enabled: true,
        },
        subscription: {
          enabled: true,
          plans: WORKSPACE_PLANS
            .filter(isStripeManagedWorkspacePlan)
            .map((plan) => ({
              name: plan.id,
              priceId: resolveStripePlanPriceId(plan.id),
            })),
          authorizeReference: async ({ user, referenceId, action }) => {
            const membership = await authPool.query<{ role: string }>(
              `select role
               from member
               where "organizationId" = $1
                 and "userId" = $2
               limit 1`,
              [referenceId, user.id],
            )

            const role = membership.rows[0]?.role
            if (!role) {
              return false
            }

            if (action === 'list-subscription') {
              return isAdminRole(role)
            }

            return isAdminRole(role)
          },
          onSubscriptionComplete: async ({ subscription, stripeSubscription }) => {
            await syncWorkspaceSubscription({
              subscription,
              stripeSubscription,
            })
          },
          onSubscriptionCreated: async ({ subscription, stripeSubscription }) => {
            await syncWorkspaceSubscription({
              subscription,
              stripeSubscription,
            })
          },
          onSubscriptionUpdate: async ({ subscription }) => {
            await syncWorkspaceSubscription({
              subscription,
            })
          },
          onSubscriptionCancel: async ({ subscription }) => {
            await markWorkspaceSubscriptionCanceled(subscription)
          },
          onSubscriptionDeleted: async ({ subscription }) => {
            await markWorkspaceSubscriptionCanceled(subscription)
          },
        },
      })
    : null

let auth: any

auth = betterAuth({
  appName: 'Rift',
  baseURL: authBaseURL,
  basePath: '/api/auth',
  secret: requireEnv('BETTER_AUTH_SECRET'),
  database: authPool,
  trustedOrigins: [authBaseURL],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!shouldProvisionDefaultOrganization({
            isAnonymous: 'isAnonymous' in user ? (user.isAnonymous as boolean | null | undefined) : undefined,
          })) {
            return
          }

          const workspaceName = buildDefaultOrganizationName({
            name: user.name,
            email: user.email,
          })

          await auth.api.createOrganization({
            body: {
              userId: user.id,
              name: workspaceName,
              slug: buildOrganizationSlug({
                name: workspaceName,
                userId: user.id,
              }),
            },
          })
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const organizationId = await findFirstOrganizationForUser(session.userId)

          return {
            data: {
              ...session,
              activeOrganizationId: organizationId ?? undefined,
            },
          }
        },
      },
    },
  },
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
      allowUserToCreateOrganization: async (user) => !user.isAnonymous,
      membershipLimit: async (_user, organization): Promise<number> =>
        WorkspaceBillingRuntime.run(
          Effect.gen(function* () {
            const service = yield* WorkspaceBillingService
            return yield* service.getSeatLimit({ organizationId: organization.id })
          }),
        ),
      requireEmailVerificationOnInvitation: true,
      organizationHooks: {
        afterCreateOrganization: async ({ organization, user }) => {
          await ensureOrganizationBillingBaseline(organization.id)
          await ensureMemberAccessRecord({
            organizationId: organization.id,
            userId: user.id,
          })
          await recomputeOrgEntitlementSnapshot(organization.id)
        },
        afterAddMember: async ({ organization, member }) => {
          await ensureOrganizationBillingBaseline(organization.id)
          await ensureMemberAccessRecord({
            organizationId: organization.id,
            userId: member.userId,
          })
          await recomputeOrgEntitlementSnapshot(organization.id)
        },
        beforeCreateInvitation: async ({ organization }) => {
          try {
            await WorkspaceBillingRuntime.run(
              Effect.gen(function* () {
                const service = yield* WorkspaceBillingService
                yield* service.assertInvitationCapacity({
                  organizationId: organization.id,
                  inviteCount: 1,
                })
              }),
            )
          } catch (error) {
            if (
              error
              && typeof error === 'object'
              && '_tag' in error
              && error._tag === 'WorkspaceBillingSeatLimitExceededError'
            ) {
              throw toInvitationSeatLimitApiError(error as never)
            }
            throw error
          }
        },
        afterCreateInvitation: async ({ organization }) => {
          await recomputeOrgEntitlementSnapshot(organization.id)
        },
        afterAcceptInvitation: async ({ organization }) => {
          await recomputeOrgEntitlementSnapshot(organization.id)
        },
        afterRejectInvitation: async ({ organization }) => {
          await recomputeOrgEntitlementSnapshot(organization.id)
        },
        afterCancelInvitation: async ({ organization }) => {
          await recomputeOrgEntitlementSnapshot(organization.id)
        },
        afterRemoveMember: async ({ organization }) => {
          await recomputeOrgEntitlementSnapshot(organization.id)
        },
      },
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
    ...(stripePlugin ? [stripePlugin] : []),
    ...(isTestRuntime ? [testUtils()] : []),
    anonymous({
      generateName: () => 'Human',
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

export { auth }
