import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSingularityAdminAuth } from './singularity-auth.server'
import { SINGULARITY_ORG_ID } from '@/ee/singularity/shared/singularity'
import {
  SingularityForbiddenError,
  SingularityMissingOrganizationError,
  SingularityUnauthorizedError,
} from '../domain/errors'

const mocks = vi.hoisted(() => ({
  getSessionFromHeadersMock: vi.fn(),
  isOrgMemberMock: vi.fn(),
}))

vi.mock('@/lib/backend/auth/services/server-session.service', () => ({
  getSessionFromHeaders: mocks.getSessionFromHeadersMock,
}))

vi.mock('@/lib/backend/auth/services/organization-member-role.service', () => ({
  isOrgMember: mocks.isOrgMemberMock,
}))

describe('requireSingularityAdminAuth', () => {
  beforeEach(() => {
    mocks.getSessionFromHeadersMock.mockReset()
    mocks.isOrgMemberMock.mockReset()
  })

  it('rejects requests without a session', async () => {
    mocks.getSessionFromHeadersMock.mockResolvedValue(null)

    await expect(requireSingularityAdminAuth(new Headers())).rejects.toBeInstanceOf(
      SingularityUnauthorizedError,
    )
  })

  it('rejects anonymous sessions', async () => {
    mocks.getSessionFromHeadersMock.mockResolvedValue({
      session: {
        id: 'session-1',
        userId: 'user-1',
        activeOrganizationId: SINGULARITY_ORG_ID,
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isAnonymous: true,
      },
    })

    await expect(requireSingularityAdminAuth(new Headers())).rejects.toBeInstanceOf(
      SingularityUnauthorizedError,
    )
  })

  it('rejects sessions without an active organization', async () => {
    mocks.getSessionFromHeadersMock.mockResolvedValue({
      session: {
        id: 'session-1',
        userId: 'user-1',
        activeOrganizationId: undefined,
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isAnonymous: false,
      },
    })

    await expect(requireSingularityAdminAuth(new Headers())).rejects.toBeInstanceOf(
      SingularityMissingOrganizationError,
    )
  })

  it('rejects access from non-Singularity workspaces', async () => {
    mocks.getSessionFromHeadersMock.mockResolvedValue({
      session: {
        id: 'session-1',
        userId: 'user-1',
        activeOrganizationId: 'org-other',
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isAnonymous: false,
      },
    })

    await expect(requireSingularityAdminAuth(new Headers())).rejects.toBeInstanceOf(
      SingularityForbiddenError,
    )
  })

  it('rejects users who are no longer members of the Singularity workspace', async () => {
    mocks.getSessionFromHeadersMock.mockResolvedValue({
      session: {
        id: 'session-1',
        userId: 'user-1',
        activeOrganizationId: SINGULARITY_ORG_ID,
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isAnonymous: false,
      },
    })
    mocks.isOrgMemberMock.mockResolvedValue(false)

    await expect(requireSingularityAdminAuth(new Headers())).rejects.toBeInstanceOf(
      SingularityForbiddenError,
    )
  })

  it('returns the normalized auth context for valid Singularity admins', async () => {
    mocks.getSessionFromHeadersMock.mockResolvedValue({
      session: {
        id: 'session-1',
        userId: 'user-1',
        activeOrganizationId: SINGULARITY_ORG_ID,
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isAnonymous: false,
      },
    })
    mocks.isOrgMemberMock.mockResolvedValue(true)

    await expect(requireSingularityAdminAuth(new Headers())).resolves.toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      organizationId: SINGULARITY_ORG_ID,
    })
  })
})
