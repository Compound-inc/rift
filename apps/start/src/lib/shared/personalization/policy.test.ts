import { describe, expect, it } from 'vitest'
import { resolveMemoryPolicy, validateMemoryOrganization } from './policy'

describe('memory policy', () => {
  for (const configured of [false, true])
    for (const orgMemoryEnabled of [false, true])
      for (const requireZdr of [false, true])
        for (const userEnabled of [false, true]) {
          it(`resolves key=${configured}, org=${orgMemoryEnabled}, ZDR=${requireZdr}, user=${userEnabled}`, () => {
            expect(
              resolveMemoryPolicy({
                configured,
                organizationId: 'org',
                orgMemoryEnabled,
                requireZdr,
                userEnabled,
              }).enabled,
            ).toBe(configured && orgMemoryEnabled && !requireZdr && userEnabled)
          })
        }
  it('allows a new member only when the deployment and workspace allow it', () => {
    expect(
      resolveMemoryPolicy({ configured: true, organizationId: 'org' }).enabled,
    ).toBe(true)
    expect(
      resolveMemoryPolicy({ configured: false, organizationId: 'org' }).reason,
    ).toBe('unconfigured')
  })
  it('never enables memory outside an organization or in a temporary context', () => {
    expect(resolveMemoryPolicy({ configured: true }).enabled).toBe(false)
    expect(
      resolveMemoryPolicy({
        configured: true,
        organizationId: 'org',
        temporary: true,
      }).enabled,
    ).toBe(false)
  })
  it('ZDR overrides user consent and organization allowance', () => {
    expect(
      resolveMemoryPolicy({
        configured: true,
        organizationId: 'org',
        requireZdr: true,
        orgMemoryEnabled: true,
        userEnabled: true,
      }).reason,
    ).toBe('zdr')
  })
})

it('rejects workspace changes across tabs and never accepts a client-only organization', () => {
  expect(validateMemoryOrganization('org-a', 'org-b')).toBe(false)
  expect(validateMemoryOrganization(undefined, 'org-b')).toBe(false)
  expect(validateMemoryOrganization('org-a', undefined)).toBe(false)
  expect(validateMemoryOrganization('org-a', 'org-a')).toBe(true)
  expect(validateMemoryOrganization(undefined, undefined)).toBe(true)
})
