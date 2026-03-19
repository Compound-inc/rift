import { betterAuth } from 'better-auth'
import { stripe } from '@better-auth/stripe'
import { emailOTP, testUtils } from 'better-auth/plugins'
import { anonymous } from 'better-auth/plugins/anonymous'
import { multiSession } from 'better-auth/plugins/multi-session'
import { organization as organizationPlugin } from 'better-auth/plugins/organization'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import Stripe from 'stripe'
import type { PoolClient } from 'pg'
import {
  isStripeManagedWorkspacePlan,
  WORKSPACE_PLANS,
  resolveStripePlanPriceId,
} from '@/lib/shared/access-control'
import {
  assertInvitationCapacity,
  getOrganizationSeatLimit,
  markWorkspaceSubscriptionCanceledFromAuth,
  recomputeOrgEntitlementSnapshot,
  syncWorkspaceSubscriptionFromAuth,
} from '@/lib/backend/billing/integrations/auth-billing-hooks'
import {
  toInvitationSeatLimitApiError,
} from '@/lib/backend/billing/domain/api-errors'
import { isAdminRole } from '@/lib/shared/auth/roles'
import { authPool } from './auth-pool'
import {
  buildDefaultOrganizationName,
  ensureMemberAccessRecord,
  ensureOrganizationBillingBaseline,
  findFirstOrganizationForUser,
  shouldProvisionDefaultOrganization,
  slugifyOrganizationName,
} from './default-organization'
import {
  sendAuthOtpEmail,
  sendAuthVerificationLinkEmail,
  sendOrganizationInvitationEmail,
} from './auth-email.server'
import type { Subscription as BetterAuthStripeSubscription } from '@better-auth/stripe'

async function syncWorkspaceSubscription(input: {
  subscription: BetterAuthStripeSubscription
  stripeSubscription?: Stripe.Subscription
  billingProvider?: 'stripe' | 'manual'
}): Promise<void> {
  await syncWorkspaceSubscriptionFromAuth(input)
}

async function markWorkspaceSubscriptionCanceled(input: {
  id: string
  plan: string
  referenceId: string
  status: BetterAuthStripeSubscription['status']
  cancelAtPeriodEnd?: boolean
}): Promise<void> {
  await markWorkspaceSubscriptionCanceledFromAuth(input)
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

/**
 * Serializes default-org provisioning and anonymous-link migration by user.
 * A transaction-scoped advisory lock keeps concurrent auth hooks from racing
 * and accidentally issuing duplicate organization creation attempts.
 */
async function withUserProvisioningLock<T>(
  userId: string,
  operation: (lockClient: PoolClient) => Promise<T>,
): Promise<T> {
  const lockKey = `auth-user-provision:${userId}`
  const client = await authPool.connect()

  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey])
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

async function readFirstOrganizationForUserWithClient(
  client: PoolClient,
  userId: string,
): Promise<string | null> {
  const result = await client.query<{ organizationId: string }>(
    `select "organizationId" as "organizationId"
     from member
     where "userId" = $1
     order by "createdAt" asc
     limit 1`,
    [userId],
  )

  return result.rows[0]?.organizationId ?? null
}

/**
 * Idempotently ensures the persisted user has a default organization.
 * Must be called while holding `withUserProvisioningLock`.
 */
async function ensureDefaultOrganizationForUserWithinLock(input: {
  lockClient: PoolClient
  userId: string
  name: string
  email: string
}): Promise<string> {
  const existingOrganizationId = await readFirstOrganizationForUserWithClient(
    input.lockClient,
    input.userId,
  )
  if (existingOrganizationId) {
    return existingOrganizationId
  }

  const workspaceName = buildDefaultOrganizationName({
    name: input.name,
    email: input.email,
  })

  await auth.api.createOrganization({
    body: {
      userId: input.userId,
      name: workspaceName,
      slug: buildOrganizationSlug({
        name: workspaceName,
        userId: input.userId,
      }),
    },
  })

  const createdOrganizationId = await readFirstOrganizationForUserWithClient(
    input.lockClient,
    input.userId,
  )
  if (!createdOrganizationId) {
    throw new Error(
      `Default organization was not found after provisioning for user ${input.userId}`,
    )
  }

  return createdOrganizationId
}

async function ensureDefaultOrganizationForUser(input: {
  userId: string
  name: string
  email: string
}): Promise<string> {
  return withUserProvisioningLock(input.userId, (lockClient) =>
    ensureDefaultOrganizationForUserWithinLock({
      lockClient,
      userId: input.userId,
      name: input.name,
      email: input.email,
    }),
  )
}

const auth = betterAuth({
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
          await ensureDefaultOrganizationForUser({
            userId: user.id,
            name: user.name,
            email: user.email,
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
    additionalFields: {
      preferredLocale: {
        type: 'string',
        required: false,
      },
    },
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
  emailVerification: {
    async sendVerificationEmail({ user, url }, request) {
      const acceptLanguageHeader = request?.headers.get('accept-language')
      void sendAuthVerificationLinkEmail({
        to: user.email,
        verifyUrl: url,
        userId: user.id,
        fallbackAcceptLanguageHeader: acceptLanguageHeader,
      }).catch((error) => {
        console.error('Failed to send verification-link email', error)
      })
    },
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
        void sendAuthOtpEmail({
          to: email,
          otp,
          kind: type,
          expiresInMinutes: 5,
        }).catch((error) => {
          console.error(`Failed to send ${type} OTP`, error)
        })
      },
    }),
    organizationPlugin({
      allowUserToCreateOrganization: async (user) => !user.isAnonymous,
      /**
       * Keep workspace sprawl bounded per account.
       * Better Auth enforces this during organization creation requests.
       */
      organizationLimit: 10,
      membershipLimit: async (_user, organization): Promise<number> =>
        getOrganizationSeatLimit(organization.id),
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
            await assertInvitationCapacity({
              organizationId: organization.id,
              inviteCount: 1,
            })
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
        const inviterName = data.inviter.user.name || data.inviter.user.email || 'A team member'
        const orgName = data.organization.name || 'the organization'
        void sendOrganizationInvitationEmail({
          to: data.email,
          inviteLink,
          inviterName,
          organizationName: orgName,
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
        /**
         * Reassign app-owned rows so guest chat history survives account upgrade.
         */
        const fromUserId = anonymousUser.user.id
        const toUserId = newUser.user.id
        await withUserProvisioningLock(toUserId, async (lockClient) => {
          const targetOrganizationId = await ensureDefaultOrganizationForUserWithinLock({
            lockClient,
            userId: toUserId,
            name: newUser.user.name,
            email: newUser.user.email,
          })

          await lockClient.query(
            `UPDATE threads
             SET user_id = $1,
                 owner_org_id = COALESCE(owner_org_id, $3)
             WHERE user_id = $2`,
            [toUserId, fromUserId, targetOrganizationId],
          )
          await lockClient.query(
            'UPDATE messages SET user_id = $1 WHERE user_id = $2',
            [toUserId, fromUserId],
          )
          await lockClient.query(
            `UPDATE attachments
             SET user_id = $1,
                 owner_org_id = COALESCE(owner_org_id, $3)
             WHERE user_id = $2`,
            [toUserId, fromUserId, targetOrganizationId],
          )
          await lockClient.query(
            'UPDATE chat_request_rate_limit_window SET user_id = $1 WHERE user_id = $2',
            [toUserId, fromUserId],
          )
          await lockClient.query(
            'UPDATE chat_free_allowance_window SET user_id = $1 WHERE user_id = $2',
            [toUserId, fromUserId],
          )
          await lockClient.query(
            `delete from org_user_usage_summary target
             using org_user_usage_summary source
             where target.user_id = $1
               and source.user_id = $2
               and target.organization_id = source.organization_id
               and target.updated_at <= source.updated_at`,
            [toUserId, fromUserId],
          )
          await lockClient.query(
            `delete from org_user_usage_summary source
             using org_user_usage_summary target
             where source.user_id = $2
               and target.user_id = $1
               and source.organization_id = target.organization_id
               and source.updated_at < target.updated_at`,
            [toUserId, fromUserId],
          )
          await lockClient.query(
            'UPDATE org_user_usage_summary SET user_id = $1 WHERE user_id = $2',
            [toUserId, fromUserId],
          )
        })
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
    crossSubDomainCookies: process.env.BETTER_AUTH_COOKIE_DOMAIN?.trim()
      ? {
          enabled: true,
          domain: process.env.BETTER_AUTH_COOKIE_DOMAIN.trim(),
        }
      : { enabled: true },
  },
})

export { auth }
