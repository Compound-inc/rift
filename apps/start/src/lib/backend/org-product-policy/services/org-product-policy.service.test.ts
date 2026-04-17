import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { OrgProductPolicyService } from './org-product-policy.service'

describe('OrgProductPolicyService', () => {
  it('persists and reloads product policy in memory mode', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* OrgProductPolicyService

        yield* service.setPolicy({
          organizationId: 'org-1',
          productKey: 'writing',
          requestId: 'req-1',
          policy: {
            capabilities: { export: false },
            settings: { mode: 'strict' },
            disabledProviderIds: ['openai'],
            disabledModelIds: ['gpt-5'],
            disabledToolKeys: ['openai.web_search'],
            complianceFlags: { zdr: true },
          },
        })

        return yield* service.getPolicy({
          organizationId: 'org-1',
          productKey: 'writing',
          requestId: 'req-2',
        })
      }).pipe(Effect.provide(OrgProductPolicyService.layerMemory)),
    )

    expect(result).toMatchObject({
      organizationId: 'org-1',
      productKey: 'writing',
      capabilities: { export: false },
      settings: { mode: 'strict' },
      disabledProviderIds: ['openai'],
      disabledModelIds: ['gpt-5'],
      disabledToolKeys: ['openai.web_search'],
      complianceFlags: { zdr: true },
    })
  })

  it('removes persisted policy when the normalized payload is empty', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* OrgProductPolicyService

        yield* service.setPolicy({
          organizationId: 'org-1',
          productKey: 'writing',
          requestId: 'req-3',
          policy: {
            capabilities: { export: false },
            settings: {},
            disabledProviderIds: [],
            disabledModelIds: [],
            disabledToolKeys: [],
            complianceFlags: {},
          },
        })

        yield* service.setPolicy({
          organizationId: 'org-1',
          productKey: 'writing',
          requestId: 'req-4',
          policy: {
            capabilities: {},
            settings: {},
            disabledProviderIds: [],
            disabledModelIds: [],
            disabledToolKeys: [],
            complianceFlags: {},
          },
        })

        return yield* service.getPolicy({
          organizationId: 'org-1',
          productKey: 'writing',
          requestId: 'req-5',
        })
      }).pipe(Effect.provide(OrgProductPolicyService.layerMemory)),
    )

    expect(result).toBeUndefined()
  })

  it('rejects unknown product keys with a typed error', async () => {
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* OrgProductPolicyService
          return yield* service.getPolicy({
            organizationId: 'org-1',
            productKey: 'unknown',
            requestId: 'req-6',
          })
        }).pipe(Effect.provide(OrgProductPolicyService.layerMemory)),
      ),
    ).rejects.toMatchObject({
      _tag: 'OrgProductPolicyInvalidRequestError',
      productKey: 'unknown',
    })
  })
})
