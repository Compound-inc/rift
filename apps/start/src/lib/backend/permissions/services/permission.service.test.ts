import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  EMPTY_PERMISSION_BUNDLE,
  setCapability,
} from '@/lib/shared/permissions'
import {
  resolveProductEntitlements,
  resolveWorkspaceEffectiveFeatures,
} from '@/lib/shared/access-control'
import { PermissionService } from './permission.service'
import { PermissionDeniedError } from '../domain/errors'

describe('PermissionService.layerMemory', () => {
  it('authorizes when the bundle allows the permission', async () => {
    const bundle = setCapability({
      bundle: {
        ...EMPTY_PERMISSION_BUNDLE,
        planId: 'enterprise',
        effectiveFeatures: resolveWorkspaceEffectiveFeatures({
          planId: 'enterprise',
        }),
        productAddonEntitlements: resolveProductEntitlements({
          addonGrants: { hr: true, 'hr.recruitment': true },
        }),
      },
      productKey: 'hr',
      enabled: true,
    })

    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PermissionService
        yield* service.authorize({
          organizationId: 'org-1',
          userId: 'user-1',
          permissionKey: 'product.hr.recruitment',
        })
      }).pipe(Effect.provide(PermissionService.layerMemory(bundle))),
    )
  })

  it('fails with PermissionDeniedError when the bundle denies the permission', async () => {
    const bundle = EMPTY_PERMISSION_BUNDLE

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* PermissionService
          yield* service.authorize({
            organizationId: 'org-1',
            userId: 'user-1',
            permissionKey: 'product.hr',
          })
        }).pipe(Effect.provide(PermissionService.layerMemory(bundle))),
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('returns a context whose can()/check() mirrors the bundle resolver', async () => {
    const bundle = {
      ...EMPTY_PERMISSION_BUNDLE,
      productAddonEntitlements: resolveProductEntitlements({
        addonGrants: { hr: true },
      }),
    }

    const context = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PermissionService
        return yield* service.forOrg({
          organizationId: 'org-1',
          userId: 'user-1',
        })
      }).pipe(Effect.provide(PermissionService.layerMemory(bundle))),
    )

    expect(context.can('product.hr')).toBe(true)
    expect(context.can('product.hr.recruitment')).toBe(false)
    expect(context.check('product.hr.recruitment').reason).toBe('not-entitled')
  })
})

describe('PermissionService.layerNoop', () => {
  it('always allows every permission', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PermissionService
        yield* service.authorize({
          organizationId: 'org-1',
          userId: 'user-1',
          permissionKey: 'product.hr.recruitment',
        })
        const context = yield* service.forOrg({
          organizationId: 'org-1',
          userId: 'user-1',
        })
        expect(context.can('workspace.byok')).toBe(true)
      }).pipe(Effect.provide(PermissionService.layerNoop)),
    )
  })
})
