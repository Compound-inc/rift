import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isOrgAdmin,
  isOrgMember,
} from './organization-member-role.server'

const mocks = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
  authPoolQueryMock: vi.fn(),
}))

vi.mock('./auth.server', () => ({
  auth: {
    api: {
      hasPermission: mocks.hasPermissionMock,
    },
  },
}))

vi.mock('./auth-pool', () => ({
  authPool: {
    query: mocks.authPoolQueryMock,
  },
}))

describe('organization member role resolver', () => {
  beforeEach(() => {
    mocks.hasPermissionMock.mockReset()
    mocks.authPoolQueryMock.mockReset()
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
    mocks.authPoolQueryMock.mockResolvedValue({
      rows: [{ isMember: true }],
    })

    const allowed = await isOrgMember({
      organizationId: 'org_123',
      userId: 'user_123',
    })

    expect(allowed).toBe(true)
    expect(mocks.authPoolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('from member'),
      ['org_123', 'user_123'],
    )
  })

  it('returns false when membership input is incomplete', async () => {
    const allowed = await isOrgMember({
      organizationId: 'org_123',
      userId: undefined,
    })

    expect(allowed).toBe(false)
    expect(mocks.authPoolQueryMock).not.toHaveBeenCalled()
  })

  it('bubbles membership query failures so callers can treat them as retriable', async () => {
    mocks.authPoolQueryMock.mockRejectedValue(new Error('db unavailable'))

    await expect(
      isOrgMember({
        organizationId: 'org_123',
        userId: 'user_123',
      }),
    ).rejects.toThrow('db unavailable')
  })
})
