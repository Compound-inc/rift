import { describe, expect, it } from 'vitest'
import {
  buildDefaultOrganizationName,
  shouldProvisionDefaultOrganization,
} from './domain/default-organization.helpers'

describe('default organization provisioning', () => {
  it('skips provisioning for anonymous users', () => {
    expect(shouldProvisionDefaultOrganization({ isAnonymous: true })).toBe(false)
  })

  it('provisions regular users', () => {
    expect(shouldProvisionDefaultOrganization({ isAnonymous: false })).toBe(true)
  })

  it('derives a human-friendly workspace name from email fallback data', () => {
    expect(
      buildDefaultOrganizationName({
        name: 'Human',
        email: 'acme_team@example.com',
      }),
    ).toBe("Acme Team's Workspace")
  })
})
