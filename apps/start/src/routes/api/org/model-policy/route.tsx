import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { z } from 'zod'
import { WorkspaceBillingService } from '@/lib/billing-backend/services/workspace-billing.service'
import {
  ModelPolicyRuntime,
  OrgModelPolicyInvalidRequestError,
  OrgModelPolicyMissingOrgContextError,
  OrgModelPolicyService,
  OrgModelPolicyUnauthorizedError,
  toOrgModelPolicyErrorResponse,
} from '@/lib/model-policy-backend'
import { requireOrgAuth } from '@/lib/server-effect/http/server-auth'

/** Request shape for provider-level policy updates. */
const ToggleProviderBody = z.object({
  action: z.literal('toggle_provider'),
  providerId: z.string().trim().min(1),
  disabled: z.boolean(),
})

/** Request shape for model-level policy updates. */
const ToggleModelBody = z.object({
  action: z.literal('toggle_model'),
  modelId: z.string().trim().min(1),
  disabled: z.boolean(),
})

/** Request shape for compliance flag updates. */
const ToggleComplianceFlagBody = z.object({
  action: z.literal('toggle_compliance_flag'),
  flag: z.string().trim().min(1),
  enabled: z.boolean(),
})

/** Request shape for organization-wide enforced mode updates. */
const SetEnforcedModeBody = z.object({
  action: z.literal('set_enforced_mode'),
  modeId: z.string().trim().min(1).nullable(),
})

const ToggleProviderNativeToolsBody = z.object({
  action: z.literal('toggle_provider_native_tools'),
  enabled: z.boolean(),
})

const ToggleExternalToolsBody = z.object({
  action: z.literal('toggle_external_tools'),
  enabled: z.boolean(),
})

const ToggleToolBody = z.object({
  action: z.literal('toggle_tool'),
  toolKey: z.string().trim().min(1),
  disabled: z.boolean(),
})

/** Union for supported update actions handled by POST /api/org/model-policy. */
const UpdatePolicyBody = z.discriminatedUnion('action', [
  ToggleProviderBody,
  ToggleModelBody,
  ToggleComplianceFlagBody,
  SetEnforcedModeBody,
  ToggleProviderNativeToolsBody,
  ToggleExternalToolsBody,
  ToggleToolBody,
])

/** Org-scoped API for model policy read/write operations. */
export const Route = createFileRoute('/api/org/model-policy')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = crypto.randomUUID()

        const program = Effect.gen(function* () {
          const authContext = yield* requireOrgAuth({
            headers: request.headers,
            onUnauthorized: () =>
              new OrgModelPolicyUnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
            onMissingOrg: () =>
              new OrgModelPolicyMissingOrgContextError({
                message: 'Organization context is required for org settings.',
                requestId,
              }),
          })

          const policyService = yield* OrgModelPolicyService
          const payload = yield* policyService.getPayload({
            organizationId: authContext.organizationId,
            requestId,
          })

          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        })

        try {
          return await ModelPolicyRuntime.run(program)
        } catch (error) {
          return toOrgModelPolicyErrorResponse(error, requestId)
        }
      },
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID()

        const program = Effect.gen(function* () {
          const authContext = yield* requireOrgAuth({
            headers: request.headers,
            onUnauthorized: () =>
              new OrgModelPolicyUnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
            onMissingOrg: () =>
              new OrgModelPolicyMissingOrgContextError({
                message: 'Organization context is required for org settings.',
                requestId,
              }),
          })

          const rawBody = yield* Effect.tryPromise({
            try: () => request.json(),
            catch: () =>
              new OrgModelPolicyInvalidRequestError({
                message: 'Invalid JSON body',
                requestId,
              }),
          })
          const parsedBody = UpdatePolicyBody.safeParse(rawBody)
          if (!parsedBody.success) {
            return yield* Effect.fail(
              new OrgModelPolicyInvalidRequestError({
                message: 'Invalid payload',
                requestId,
                details: parsedBody.error.issues,
              }),
            )
          }

          const feature
            = parsedBody.data.action === 'toggle_compliance_flag'
              ? 'compliancePolicy'
              : parsedBody.data.action === 'toggle_provider_native_tools'
                  || parsedBody.data.action === 'toggle_external_tools'
                  || parsedBody.data.action === 'toggle_tool'
                ? 'toolPolicy'
                : 'providerPolicy'

          const billing = yield* WorkspaceBillingService
          yield* billing.assertFeatureEnabled({
            organizationId: authContext.organizationId,
            feature,
          })

          const policyService = yield* OrgModelPolicyService
          const payload = yield* policyService.updatePolicy({
            organizationId: authContext.organizationId,
            requestId,
            action: parsedBody.data,
          })

          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        })

        try {
          return await ModelPolicyRuntime.run(program)
        } catch (error) {
          return toOrgModelPolicyErrorResponse(error, requestId)
        }
      },
    },
  },
})
