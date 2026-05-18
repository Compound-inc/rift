import { betterAuth } from 'better-auth'
import { stripe } from '@better-auth/stripe'
import { emailOTP, testUtils } from 'better-auth/plugins'
import { anonymous } from 'better-auth/plugins/anonymous'
import { multiSession } from 'better-auth/plugins/multi-session'
import { organization as organizationPlugin } from 'better-auth/plugins/organization'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import Stripe from 'stripe'
import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
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
import { toInvitationSeatLimitApiError } from '@/lib/backend/billing/domain/api-errors'
import {
  ORGANIZATION_SYSTEM_ROLES,
  organizationAccessControl,
} from '@/lib/shared/auth/org-access-control'
import { isAdminRole } from '@/lib/shared/auth/roles'
import { runUpstreamPostgresEffect } from '@/lib/backend/server-effect/runtime/upstream-postgres-runtime'
import { authPool } from '@/lib/backend/auth/infra/auth-pool'
import {
  buildDefaultOrganizationName,
  findFirstOrganizationForUserEffect,
  ensureMemberAccessRecord,
  ensureOrganizationBillingBaseline,
  findFirstOrganizationForUser,
  shouldProvisionDefaultOrganization,
  slugifyOrganizationName,
} from '@/lib/backend/auth/services/default-organization.service'
import {
  sendAuthOtpEmail,
  sendOrganizationInvitationEmail,
} from '@/lib/backend/auth/services/auth-email.service'
import type { Subscription as BetterAuthStripeSubscription } from '@better-auth/stripe'
import {
  readOrganizationMemberRoleEffect,
  reassignAnonymousAppDataEffect,
  runAuthSqlEffect,
} from '@/lib/backend/auth/services/auth-sql.service'
import {
  getSelfHostedInstanceSettings,
  hasPendingSelfHostedInvitationForEmail,
  verifySelfHostedSetupToken,
  verifySelfHostedSignupSecret,
} from '@/lib/backend/self-host/instance-settings.service'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { isSelfHosted } from '@/utils/app-feature-flags'

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
    throw new Error(`Missing required environment variable ${name}.`)
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
const isTestRuntime =
  process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
function buildOrganizationSlug(input: {
  name: string
  userId: string
}): string {
  const base = slugifyOrganizationName(input.name) || 'workspace'
  return `${base}-${input.userId.slice(0, 8)}`
}

const stripePlugin =
  !isSelfHosted && stripeSecretKey && stripeWebhookSecret
    ? stripe({
        stripeClient: new Stripe(stripeSecretKey),
        stripeWebhookSecret,
        organization: {
          enabled: true,
        },
        subscription: {
          enabled: true,
          plans: WORKSPACE_PLANS.filter(isStripeManagedWorkspacePlan).map(
            (plan) => ({
              name: plan.id,
              priceId: resolveStripePlanPriceId(plan.id),
            }),
          ),
          authorizeReference: async ({ user, referenceId, action }) => {
            const role = await runAuthSqlEffect(
              readOrganizationMemberRoleEffect({
                organizationId: referenceId,
                userId: user.id,
              }),
            )
            if (!role) {
              return false
            }

            if (action === 'list-subscription') {
              return isAdminRole(role)
            }

            return isAdminRole(role)
          },
          onSubscriptionComplete: async ({
            subscription,
            stripeSubscription,
          }) => {
            await syncWorkspaceSubscription({
              subscription,
              stripeSubscription,
            })
          },
          onSubscriptionCreated: async ({
            subscription,
            stripeSubscription,
          }) => {
            await syncWorkspaceSubscription({
              subscription,
              stripeSubscription,
            })
          },
          onSubscriptionUpdate: async (data) => {
            await syncWorkspaceSubscription({
              subscription: data.subscription,
              stripeSubscription: (
                data as { stripeSubscription?: Stripe.Subscription }
              ).stripeSubscription,
            })
          },
          onSubscriptionCancel: async ({
            subscription,
            stripeSubscription,
          }) => {
            await syncWorkspaceSubscription({
              subscription,
              stripeSubscription,
            })
          },
          onSubscriptionDeleted: async ({ subscription }) => {
            await markWorkspaceSubscriptionCanceled(subscription)
          },
          getCheckoutSessionParams: async () => {
            return {
              params: {
                allow_promotion_codes: true,
              },
            }
          },
        },
      })
    : null

function readStringRecordValue(record: unknown, key: string): string | null {
  if (!record || typeof record !== 'object') return null
  const value = (record as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function isSelfHostedSocialPath(path: string): boolean {
  return (
    path === '/sign-in/social' ||
    path === '/link-social' ||
    path.startsWith('/callback/') ||
    path.startsWith('/oauth2/callback/')
  )
}

function isSelfHostedEmailDeliveryPath(path: string): boolean {
  return (
    path === '/verify-email' ||
    path === '/request-password-reset' ||
    path.startsWith('/reset-password') ||
    path.startsWith('/email-otp/') ||
    path === '/forget-password/email-otp'
  )
}

const selfHostedAuthGuard = createAuthMiddleware(async (ctx) => {
  if (!isSelfHosted) {
    return
  }

  const path = ctx.path ?? ''

  if (isSelfHostedSocialPath(path)) {
    throw APIError.from('FORBIDDEN', {
      code: 'SELF_HOSTED_SOCIAL_AUTH_DISABLED',
      message: 'Social auth is disabled for self-hosted instances.',
    })
  }

  if (isSelfHostedEmailDeliveryPath(path)) {
    throw APIError.from('FORBIDDEN', {
      code: 'SELF_HOSTED_EMAIL_DELIVERY_DISABLED',
      message:
        'Email verification and password recovery are disabled for self-hosted instances.',
    })
  }

  if (path !== '/sign-up/email') {
    return
  }

  const email = readStringRecordValue(ctx.body, 'email')
  if (!email) {
    throw APIError.from('BAD_REQUEST', {
      code: 'SELF_HOSTED_SIGNUP_EMAIL_REQUIRED',
      message: 'A valid email address is required to sign up.',
    })
  }

  const setupToken =
    ctx.headers?.get('x-rift-setup-token')?.trim() ??
    readStringRecordValue(ctx.body, 'selfHostedSetupToken')
  const signupSecret =
    ctx.headers?.get('x-rift-signup-secret')?.trim() ??
    readStringRecordValue(ctx.body, 'selfHostedSignupSecret')
  const settings = await getSelfHostedInstanceSettings()

  if (settings.setupCompletedAt == null) {
    if (!setupToken || !verifySelfHostedSetupToken(setupToken)) {
      throw APIError.from('UNAUTHORIZED', {
        code: 'SELF_HOSTED_SETUP_REQUIRED',
        message:
          'This self-hosted instance has not been claimed yet. Complete setup first.',
      })
    }

    return
  }

  if (settings.signupPolicy === 'open') {
    return
  }

  if (settings.signupPolicy === 'shared_secret') {
    if (
      !signupSecret ||
      !settings.signupSecretHash ||
      !verifySelfHostedSignupSecret({
        secret: signupSecret,
        hash: settings.signupSecretHash,
      })
    ) {
      throw APIError.from('FORBIDDEN', {
        code: 'SELF_HOSTED_SIGNUP_SECRET_INVALID',
        message: 'A valid shared signup secret is required for this instance.',
      })
    }

    return
  }

  const hasInvitation = await hasPendingSelfHostedInvitationForEmail(email)
  if (!hasInvitation) {
    throw APIError.from('FORBIDDEN', {
      code: 'SELF_HOSTED_INVITE_ONLY',
      message:
        'This self-hosted instance currently accepts invite-only signups.',
    })
  }
})

/**
 * Serializes default-org provisioning and anonymous-link migration by user.
 * A transaction-scoped advisory lock keeps concurrent auth hooks from racing
 * and accidentally issuing duplicate organization creation attempts.
 */
const withUserProvisioningLockEffect = Effect.fn(
  'Auth.withUserProvisioningLock',
)(
  <T>(
    userId: string,
    operation: Effect.Effect<T, unknown, PgClient.PgClient>,
  ): Effect.Effect<T, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const lockKey = `auth-user-provision:${userId}`
      const sql = yield* PgClient.PgClient

      return yield* sql.withTransaction(
        Effect.gen(function* () {
          yield* sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`
          return yield* operation
        }),
      )
    }),
)

async function withUserProvisioningLock<T>(
  userId: string,
  operation: Effect.Effect<T, unknown, PgClient.PgClient>,
): Promise<T> {
  return runUpstreamPostgresEffect(
    withUserProvisioningLockEffect(userId, operation),
  )
}

/**
 * Idempotently ensures the persisted user has a default organization.
 * Must be called while holding `withUserProvisioningLock`.
 */
const ensureDefaultOrganizationForUserWithinLockEffect = Effect.fn(
  'Auth.ensureDefaultOrganizationForUserWithinLock',
)(
  (input: {
    userId: string
    name: string
    email: string
  }): Effect.Effect<string, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const existingOrganizationId = yield* findFirstOrganizationForUserEffect(
        input.userId,
      )
      if (existingOrganizationId) {
        return existingOrganizationId
      }

      const workspaceName = buildDefaultOrganizationName({
        name: input.name,
        email: input.email,
      })

      yield* Effect.tryPromise({
        try: () =>
          auth.api.createOrganization({
            body: {
              userId: input.userId,
              name: workspaceName,
              slug: buildOrganizationSlug({
                name: workspaceName,
                userId: input.userId,
              }),
            },
          }),
        catch: (error) => error,
      })

      const createdOrganizationId = yield* findFirstOrganizationForUserEffect(
        input.userId,
      )
      if (!createdOrganizationId) {
        return yield* Effect.fail(
          new Error(
            `Default organization was not found after provisioning for user ${input.userId}`,
          ),
        )
      }

      return createdOrganizationId
    }),
)

async function ensureDefaultOrganizationForUser(input: {
  userId: string
  name: string
  email: string
}): Promise<string> {
  return withUserProvisioningLock(
    input.userId,
    ensureDefaultOrganizationForUserWithinLockEffect({
      userId: input.userId,
      name: input.name,
      email: input.email,
    }),
  )
}

/**
 * Shared Better Auth instance for both the application runtime and the CLI.
 *
 * The migration scripts load this module directly so the CLI can inspect the
 * exact same configuration that the app uses at runtime.
 */
export const auth = betterAuth({
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
          if (
            !shouldProvisionDefaultOrganization({
              isAnonymous:
                'isAnonymous' in user
                  ? (user.isAnonymous as boolean | null | undefined)
                  : undefined,
            })
          ) {
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
          const organizationId = await findFirstOrganizationForUser(
            session.userId,
          )

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
      enabled: !isSelfHosted,
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: !isSelfHosted,
    revokeSessionsOnPasswordReset: true,
  },
  ...(!isSelfHosted && googleClientId && googleClientSecret
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
    ...(!isSelfHosted
      ? [
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
        ]
      : []),
    organizationPlugin({
      ac: organizationAccessControl,
      roles: ORGANIZATION_SYSTEM_ROLES,
      dynamicAccessControl: {
        enabled: true,
        maximumRolesPerOrganization: 50,
      },
      allowUserToCreateOrganization: async (user) => !user.isAnonymous,
      /**
       * Keep workspace sprawl bounded per account.
       * Better Auth enforces this during organization creation requests.
       */
      organizationLimit: 10,
      membershipLimit: async (_user, organization): Promise<number> =>
        getOrganizationSeatLimit(organization.id),
      requireEmailVerificationOnInvitation: !isSelfHosted,
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
              error &&
              typeof error === 'object' &&
              '_tag' in error &&
              error._tag === 'WorkspaceBillingSeatLimitExceededError'
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
        if (isSelfHosted) {
          return
        }

        const inviteLink = `${authBaseURL}/auth/accept-invitation/${data.id}`
        const inviterName =
          data.inviter.user.name || data.inviter.user.email || 'A team member'
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
    ...(!isSelfHosted
      ? [
          anonymous({
            generateName: () => 'Human',
            onLinkAccount: async ({ anonymousUser, newUser }) => {
              /**
               * Reassign app-owned rows so guest chat history survives account upgrade.
               */
              const fromUserId = anonymousUser.user.id
              const toUserId = newUser.user.id
              await withUserProvisioningLock(
                toUserId,
                Effect.gen(function* () {
                  const targetOrganizationId =
                    yield* ensureDefaultOrganizationForUserWithinLockEffect({
                      userId: toUserId,
                      name: newUser.user.name,
                      email: newUser.user.email,
                    })

                  yield* reassignAnonymousAppDataEffect({
                    fromUserId,
                    toUserId,
                    targetOrganizationId,
                  })
                }),
              )
            },
          }),
        ]
      : []),
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
  hooks: {
    before: selfHostedAuthGuard,
  },
})
