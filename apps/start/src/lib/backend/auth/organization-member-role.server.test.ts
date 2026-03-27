import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isOrgAdmin,
  isOrgMember,
} from './organization-member-role.server'

const mocks = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
  readIsOrganizationMemberEffectMock: vi.fn(),
}))

vi.mock('./auth.server', () => ({
  auth: {
    api: {
      hasPermission: mocks.hasPermissionMock,
    },
  },
}))

vi.mock('./auth-sql.server', () => ({
  runAuthSqlEffect: (effect: Promise<unknown>) => effect,
  readIsOrganizationMemberEffect: mocks.readIsOrganizationMemberEffectMock,
}))

describe('organization member role resolver', () => {
  beforeEach(() => {
    mocks.hasPermissionMock.mockReset()
    mocks.readIsOrganizationMemberEffectMock.mockReset()
  })

  it('delegates org settings authorization to Better Auth permissions', async () => {
    mocks.hasPermissionMock.mockResolvedValue({ success: true })

    const allowed = await isOrgAdmin({
      headers: new Headers(),
      organizationId: 'org_123',
    })

    expect(allowed).toBe(true)
    expect(mocks.hasPermissionMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: 'org_123',
        permissions: {
          organization: ['update'],
        },
      },
    })
  })

  it('denies access when there is no active organization', async () => {
    const allowed = await isOrgAdmin({
      headers: new Headers(),
      organizationId: undefined,
    })

    expect(allowed).toBe(false)
    expect(mocks.hasPermissionMock).not.toHaveBeenCalled()
  })

  it('checks whether a user is an active member of the organization', async () => {
    mocks.readIsOrganizationMemberEffectMock.mockResolvedValue(true)

    const allowed = await isOrgMember({
      organizationId: 'org_123',
      userId: 'user_123',
    })

    expect(allowed).toBe(true)
    expect(mocks.readIsOrganizationMemberEffectMock).toHaveBeenCalledWith({
      organizationId: 'org_123',
      userId: 'user_123',
    })
  })

  it('returns false when membership input is incomplete', async () => {
    const allowed = await isOrgMember({
      organizationId: 'org_123',
      userId: undefined,
    })

    expect(allowed).toBe(false)
    expect(mocks.readIsOrganizationMemberEffectMock).not.toHaveBeenCalled()
  })

  it('bubbles membership query failures so callers can treat them as retriable', async () => {
    mocks.readIsOrganizationMemberEffectMock.mockRejectedValue(new Error('db unavailable'))

    await expect(
      isOrgMember({
        organizationId: 'org_123',
        userId: 'user_123',
      }),
    ).rejects.toThrow('db unavailable')
  })
})
