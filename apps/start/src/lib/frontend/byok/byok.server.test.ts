import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'

const mockGetRequestHeaders = vi.fn(() => new Headers())
const mockRequireOrgAuth = vi.fn()
const mockRunUpdateByok = vi.fn()
const mockRunAuthSqlEffect = vi.fn((effect: Promise<unknown>) => effect)
const mockReadOrganizationMemberRoleEffect = vi.fn()

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: mockGetRequestHeaders,
}))

vi.mock('@/lib/backend/server-effect/http/server-auth', () => ({
  requireOrgAuth: mockRequireOrgAuth,
}))

vi.mock('@/lib/backend/byok/byok-runner', () => ({
  runUpdateByok: mockRunUpdateByok,
}))

vi.mock('@/lib/backend/auth/auth-sql.server', () => ({
  runAuthSqlEffect: mockRunAuthSqlEffect,
  readOrganizationMemberRoleEffect: mockReadOrganizationMemberRoleEffect,
}))

describe('updateByokAction', () => {
  beforeEach(() => {
    mockGetRequestHeaders.mockReset()
    mockGetRequestHeaders.mockReturnValue(new Headers())
    mockRequireOrgAuth.mockReset()
    mockRunUpdateByok.mockReset()
    mockRunAuthSqlEffect.mockReset()
    mockRunAuthSqlEffect.mockImplementation((effect: Promise<unknown>) => effect)
    mockReadOrganizationMemberRoleEffect.mockReset()
    mockReadOrganizationMemberRoleEffect.mockResolvedValue('admin')
  })

  it('fails when org auth is missing', async () => {
    const { ByokMissingOrgContextError } = await import(
      '@/lib/backend/byok/domain/errors'
    )
    const { updateByokAction } = await import('./byok.server')

    mockRequireOrgAuth.mockImplementation((input: { onMissingOrg: () => unknown }) =>
      Effect.fail(input.onMissingOrg()),
    )

    await expect(
      updateByokAction({
        data: {
          action: 'remove_provider_api_key',
          providerId: 'openai',
        },
      }),
    ).rejects.toBeInstanceOf(ByokMissingOrgContextError)
  })

  it('fails when user is unauthorized', async () => {
    const { ByokUnauthorizedError } = await import(
      '@/lib/backend/byok/domain/errors'
    )
    const { updateByokAction } = await import('./byok.server')

    mockRequireOrgAuth.mockImplementation((input: { onUnauthorized: () => unknown }) =>
      Effect.fail(input.onUnauthorized()),
    )

    await expect(
      updateByokAction({
        data: {
          action: 'remove_provider_api_key',
          providerId: 'openai',
        },
      }),
    ).rejects.toBeInstanceOf(ByokUnauthorizedError)
  })

  it('executes runner with trusted organization id from auth context', async () => {
    const { updateByokAction } = await import('./byok.server')
    mockRequireOrgAuth.mockImplementation(() =>
      Effect.succeed({
        userId: 'user-1',
        organizationId: 'org-123',
        isAnonymous: false,
      }),
    )
    mockRunUpdateByok.mockResolvedValue({
      providerKeyStatus: {
        openai: true,
        anthropic: false,
      },
    })

    const result = await updateByokAction({
      data: {
        action: 'set_provider_api_key',
        providerId: 'openai',
        apiKey: 'sk-valid',
      },
    })

    expect(mockRunUpdateByok).toHaveBeenCalledWith({
      organizationId: 'org-123',
      data: {
        action: 'set_provider_api_key',
        providerId: 'openai',
        apiKey: 'sk-valid',
      },
    })
    expect(mockReadOrganizationMemberRoleEffect).toHaveBeenCalledWith({
      organizationId: 'org-123',
      userId: 'user-1',
    })
    expect(result).toEqual({
      providerKeyStatus: {
        openai: true,
        anthropic: false,
      },
    })
  })

  it('fails when caller is not owner/admin', async () => {
    const { ByokForbiddenError } = await import('@/lib/backend/byok/domain/errors')
    const { updateByokAction } = await import('./byok.server')

    mockRequireOrgAuth.mockImplementation(() =>
      Effect.succeed({
        userId: 'user-2',
        organizationId: 'org-123',
        isAnonymous: false,
      }),
    )
    mockReadOrganizationMemberRoleEffect.mockResolvedValue('member')

    await expect(
      updateByokAction({
        data: {
          action: 'remove_provider_api_key',
          providerId: 'openai',
        },
      }),
    ).rejects.toBeInstanceOf(ByokForbiddenError)
  })
})
