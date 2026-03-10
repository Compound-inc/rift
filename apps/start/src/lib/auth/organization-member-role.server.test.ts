import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
}))

vi.mock('./auth.server', () => ({
  auth: {
    api: {
      hasPermission: mocks.hasPermissionMock,
    },
  },
}))

import {
  isOrgAdmin,
} from './organization-member-role.server'

describe('organization member role resolver', () => {
  beforeEach(() => {
    mocks.hasPermissionMock.mockReset()
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
})
