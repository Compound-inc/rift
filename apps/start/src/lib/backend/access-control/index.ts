import { Effect } from 'effect'
import type {
  AccessContext,
  FeatureAccessState,
  RuntimeFeatureAccessId,
} from '@/lib/shared/access-control'
import {
  coerceWorkspacePlanId,
  getFeatureAccessState,
  isFreeTierContext,
} from '@/lib/shared/access-control'
import { runBillingSqlEffect } from '@/lib/backend/billing/services/sql'
import { readEntitlementSnapshotEffect } from '@/lib/backend/billing/services/workspace-billing/persistence'

export type ResolvedAccessContext = AccessContext & {
  userId?: string
  organizationId?: string
}

export type ResolvedChatAccessPolicy = {
  context: ResolvedAccessContext
  features: Record<RuntimeFeatureAccessId, FeatureAccessState>
  rateLimit: {
    windowMs: number
    maxRequests: number
  }
  allowance?: {
    policyKey: string
    windowMs: number
    maxRequests: number
  }
}

const DEFAULT_FREE_CHAT_RATE_LIMIT_WINDOW_MS = 60_000
const DEFAULT_FREE_CHAT_RATE_LIMIT_MAX_REQUESTS = 10
const DEFAULT_PAID_CHAT_RATE_LIMIT_WINDOW_MS = 60_000
const DEFAULT_PAID_CHAT_RATE_LIMIT_MAX_REQUESTS = 30
const DEFAULT_FREE_CHAT_ALLOWANCE_WINDOW_MS = 24 * 60 * 60 * 1000
const DEFAULT_FREE_CHAT_ALLOWANCE_MAX_REQUESTS = 100

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Expected ${name} to be a positive integer`)
  }

  return value
}

/**
 * Resolves the active plan from the request-scoped organization context.
 * Anonymous or no-org requests remain fully in-memory and default to `free`.
 */
export const resolveAccessContextEffect = Effect.fn(
  'AccessControl.resolveAccessContext',
)((input: { userId?: string; isAnonymous: boolean; organizationId?: string }) =>
  Effect.gen(function* () {
    if (!input.organizationId) {
      return {
        userId: input.userId,
        isAnonymous: input.isAnonymous,
        organizationId: undefined,
        planId: 'free' as const,
      }
    }

    const snapshot = yield* readEntitlementSnapshotEffect({
      organizationId: input.organizationId,
    })
    return {
      userId: input.userId,
      isAnonymous: input.isAnonymous,
      organizationId: input.organizationId,
      planId: coerceWorkspacePlanId(snapshot?.planId),
    }
  }),
)

export async function resolveAccessContext(input: {
  userId?: string
  isAnonymous: boolean
  organizationId?: string
}): Promise<ResolvedAccessContext> {
  return runBillingSqlEffect(resolveAccessContextEffect(input))
}

/**
 * Chat routes resolve this once and pass it through the request path so model
 * gating, uploads, and throttling all make decisions from the same snapshot.
 */
export function resolveChatAccessPolicy(
  context: ResolvedAccessContext,
): ResolvedChatAccessPolicy {
  const features: Record<RuntimeFeatureAccessId, FeatureAccessState> = {
    'chat.fileUpload': getFeatureAccessState({
      feature: 'chat.fileUpload',
      planId: context.planId,
    }),
    'chat.paidModels': getFeatureAccessState({
      feature: 'chat.paidModels',
      planId: context.planId,
    }),
  }

  if (!isFreeTierContext(context)) {
    return {
      context,
      features,
      rateLimit: {
        windowMs: readPositiveIntegerEnv(
          'PAID_CHAT_RATE_LIMIT_WINDOW_MS',
          DEFAULT_PAID_CHAT_RATE_LIMIT_WINDOW_MS,
        ),
        maxRequests: readPositiveIntegerEnv(
          'PAID_CHAT_RATE_LIMIT_MAX_REQUESTS',
          DEFAULT_PAID_CHAT_RATE_LIMIT_MAX_REQUESTS,
        ),
      },
    }
  }

  return {
    context,
    features,
    rateLimit: {
      windowMs: readPositiveIntegerEnv(
        'FREE_CHAT_RATE_LIMIT_WINDOW_MS',
        DEFAULT_FREE_CHAT_RATE_LIMIT_WINDOW_MS,
      ),
      maxRequests: readPositiveIntegerEnv(
        'FREE_CHAT_RATE_LIMIT_MAX_REQUESTS',
        DEFAULT_FREE_CHAT_RATE_LIMIT_MAX_REQUESTS,
      ),
    },
    allowance: context.userId
      ? {
          policyKey: 'free-chat-v1',
          windowMs: readPositiveIntegerEnv(
            'FREE_CHAT_ALLOWANCE_WINDOW_MS',
            DEFAULT_FREE_CHAT_ALLOWANCE_WINDOW_MS,
          ),
          maxRequests: readPositiveIntegerEnv(
            'FREE_CHAT_ALLOWANCE_MAX_REQUESTS',
            DEFAULT_FREE_CHAT_ALLOWANCE_MAX_REQUESTS,
          ),
        }
      : undefined,
  }
}
