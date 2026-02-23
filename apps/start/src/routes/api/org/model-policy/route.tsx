import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { z } from 'zod'
import { AI_CATALOG, AI_MODELS_BY_PROVIDER } from '@/lib/ai-catalog'
import {
  evaluateModelAvailability,
} from '@/lib/model-policy/policy-engine'
import { getOrgAiPolicy, upsertOrgAiPolicy } from '@/lib/model-policy/repository'

const ToggleProviderBody = z.object({
  action: z.literal('toggle_provider'),
  providerId: z.string().min(1),
  disabled: z.boolean(),
})

const ToggleModelBody = z.object({
  action: z.literal('toggle_model'),
  modelId: z.string().min(1),
  disabled: z.boolean(),
})

const ToggleComplianceFlagBody = z.object({
  action: z.literal('toggle_compliance_flag'),
  flag: z.string().min(1),
  enabled: z.boolean(),
})

const UpdatePolicyBody = z.discriminatedUnion('action', [
  ToggleProviderBody,
  ToggleModelBody,
  ToggleComplianceFlagBody,
])

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function remove(values: readonly string[], candidate: string): string[] {
  return values.filter((value) => value !== candidate)
}

function add(values: readonly string[], candidate: string): string[] {
  return unique([...values, candidate])
}

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

function toModelPayload(input: {
  readonly id: string
  readonly name: string
  readonly providerId: string
  readonly description: string
  readonly tags: readonly string[]
  readonly disabled: boolean
  readonly deniedBy: readonly ('provider' | 'model' | 'tag')[]
}) {
  return {
    id: input.id,
    name: input.name,
    providerId: input.providerId,
    description: input.description,
    tags: input.tags,
    disabled: input.disabled,
    deniedBy: input.deniedBy,
  }
}

async function buildResponsePayload(orgWorkosId: string) {
  const policy = await getOrgAiPolicy(orgWorkosId)

  const models = AI_CATALOG.map((model) => {
    const decision = evaluateModelAvailability({ model, policy })
    return toModelPayload({
      id: model.id,
      name: model.name,
      providerId: model.providerId,
      description: model.description,
      tags: model.tags,
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
      version: policy?.version ?? 0,
      updatedAt: policy?.updatedAt,
    },
    providers,
    models,
  }
}

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
