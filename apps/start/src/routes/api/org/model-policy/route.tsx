import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { z } from 'zod'
import { AI_CATALOG, AI_MODELS_BY_PROVIDER } from '@/lib/ai-catalog'
import {
  evaluateModelAvailability,
} from '@/lib/model-policy/policy-engine'
import { getOrgAiPolicy, upsertOrgAiPolicy } from '@/lib/model-policy/repository'

/** Request shape for provider-level policy updates. */
const ToggleProviderBody = z.object({
  action: z.literal('toggle_provider'),
  providerId: z.string().min(1),
  disabled: z.boolean(),
})

/** Request shape for model-level policy updates. */
const ToggleModelBody = z.object({
  action: z.literal('toggle_model'),
  modelId: z.string().min(1),
  disabled: z.boolean(),
})

/** Request shape for compliance flag updates. */
const ToggleComplianceFlagBody = z.object({
  action: z.literal('toggle_compliance_flag'),
  flag: z.string().min(1),
  enabled: z.boolean(),
})

/** Union for supported update actions handled by POST /api/org/model-policy. */
const UpdatePolicyBody = z.discriminatedUnion('action', [
  ToggleProviderBody,
  ToggleModelBody,
  ToggleComplianceFlagBody,
])

/** Deduplicates values while preserving first-seen order. */
function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

/** Removes one candidate value from an immutable string list. */
function remove(values: readonly string[], candidate: string): string[] {
  return values.filter((value) => value !== candidate)
}

/** Adds one candidate value to an immutable string list if absent. */
function add(values: readonly string[], candidate: string): string[] {
  return unique([...values, candidate])
}

/**
 * Resolves authenticated org context for org-scoped settings APIs.
 * Returns a prebuilt Response for auth/business failures to keep handlers slim.
 */
async function getOrgIdOrResponse() {
  const auth = await getAuth()
  if (!auth.user) {
    return {
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    }
  }

  const organizationId =
    'organizationId' in auth && typeof auth.organizationId === 'string'
      ? auth.organizationId
      : undefined
  const orgWorkosId = organizationId?.trim()
  if (!orgWorkosId) {
    return {
      response: new Response(
        JSON.stringify({ error: 'Organization context is required for org settings.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    }
  }

  return { orgWorkosId }
}

/** Converts internal catalog/policy rows into stable API response shape. */
function toModelPayload(input: {
  readonly id: string
  readonly name: string
  readonly providerId: string
  readonly description: string
  readonly zeroDataRetention: boolean
  readonly disabled: boolean
  readonly deniedBy: readonly ('provider' | 'model' | 'compliance')[]
}) {
  return {
    id: input.id,
    name: input.name,
    providerId: input.providerId,
    description: input.description,
    zeroDataRetention: input.zeroDataRetention,
    disabled: input.disabled,
    deniedBy: input.deniedBy,
  }
}

/** Builds full admin payload (policy + providers + model decisions) for one org. */
async function buildResponsePayload(orgWorkosId: string) {
  const policy = await getOrgAiPolicy(orgWorkosId)

  const models = AI_CATALOG.map((model) => {
    const decision = evaluateModelAvailability({ model, policy })
    return toModelPayload({
      id: model.id,
      name: model.name,
      providerId: model.providerId,
      description: model.description,
      zeroDataRetention: model.zeroDataRetention,
      disabled: !decision.allowed,
      deniedBy: decision.deniedBy,
    })
  })

  const providers = [...AI_MODELS_BY_PROVIDER.keys()].map((providerId) => ({
    id: providerId,
    disabled: policy?.disabledProviderIds.includes(providerId) ?? false,
  }))

  return {
    orgWorkosId,
    policy: {
      disabledProviderIds: policy?.disabledProviderIds ?? [],
      disabledModelIds: policy?.disabledModelIds ?? [],
      complianceFlags: policy?.complianceFlags ?? {},
      updatedAt: policy?.updatedAt,
    },
    providers,
    models,
  }
}

/** Org-scoped API for model policy read/write operations. */
export const Route = createFileRoute('/api/org/model-policy')({
  server: {
    handlers: {
      GET: async () => {
        const orgLookup = await getOrgIdOrResponse()
        if ('response' in orgLookup) return orgLookup.response

        const payload = await buildResponsePayload(orgLookup.orgWorkosId)

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
      POST: async ({ request }) => {
        const orgLookup = await getOrgIdOrResponse()
        if ('response' in orgLookup) return orgLookup.response

        const rawBody = await request.json().catch(() => null)
        const parsed = UpdatePolicyBody.safeParse(rawBody)

        if (!parsed.success) {
          return new Response(
            JSON.stringify({
              error: 'Invalid payload',
              details: parsed.error.issues,
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        const orgWorkosId = orgLookup.orgWorkosId
        const existing = await getOrgAiPolicy(orgWorkosId)

        let disabledProviderIds = existing?.disabledProviderIds ?? []
        let disabledModelIds = existing?.disabledModelIds ?? []
        let complianceFlags: Record<string, boolean> = {
          ...(existing?.complianceFlags ?? {}),
        }

        const body = parsed.data

        if (body.action === 'toggle_provider') {
          disabledProviderIds = body.disabled
            ? add(disabledProviderIds, body.providerId)
            : remove(disabledProviderIds, body.providerId)
        }

        if (body.action === 'toggle_model') {
          disabledModelIds = body.disabled
            ? add(disabledModelIds, body.modelId)
            : remove(disabledModelIds, body.modelId)
        }

        if (body.action === 'toggle_compliance_flag') {
          complianceFlags = {
            ...complianceFlags,
            [body.flag]: body.enabled,
          }
        }

        await upsertOrgAiPolicy({
          orgWorkosId,
          disabledProviderIds,
          disabledModelIds,
          complianceFlags,
        })

        const payload = await buildResponsePayload(orgWorkosId)

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
