import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'

const mockCanUseOrganizationProviderKeys = vi.fn(() => true)
const mockGetOrgPolicy = vi.fn()
const mockUpsertOrgPolicy = vi.fn()
const mockUpsertOrgProviderApiKey = vi.fn()
const mockDeleteOrgProviderApiKey = vi.fn()
const mockReadOrgProviderApiKeyStatus = vi.fn()

vi.mock('@/utils/app-feature-flags', () => ({
  get canUseOrganizationProviderKeys() {
    return mockCanUseOrganizationProviderKeys()
  },
}))

vi.mock('@/lib/backend/org-policy/repository', () => ({
  getOrgPolicy: mockGetOrgPolicy,
  upsertOrgPolicy: mockUpsertOrgPolicy,
}))

vi.mock('@/lib/backend/byok/infra/provider-key-store', () => ({
  upsertOrgProviderApiKey: mockUpsertOrgProviderApiKey,
  deleteOrgProviderApiKey: mockDeleteOrgProviderApiKey,
  readOrgProviderApiKeyStatus: mockReadOrgProviderApiKeyStatus,
}))

describe('ByokExecutorService', () => {
  beforeEach(() => {
    mockCanUseOrganizationProviderKeys.mockReset()
    mockGetOrgPolicy.mockReset()
    mockUpsertOrgPolicy.mockReset()
    mockUpsertOrgProviderApiKey.mockReset()
    mockDeleteOrgProviderApiKey.mockReset()
    mockReadOrgProviderApiKeyStatus.mockReset()
  })

  it('sets provider key and updates provider status snapshot', async () => {
    const { ByokExecutorService } = await import('./byok-executor.service')

    mockCanUseOrganizationProviderKeys.mockReturnValue(true)
    mockGetOrgPolicy.mockResolvedValue(undefined)
    mockReadOrgProviderApiKeyStatus.mockResolvedValue({
      openai: false,
      anthropic: false,
    })
    mockUpsertOrgProviderApiKey.mockResolvedValue(undefined)
    mockUpsertOrgPolicy.mockResolvedValue(undefined)

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ByokExecutorService
        return yield* service.executeUpdate('org-1', {
          action: 'set_provider_api_key',
          providerId: 'openai',
          apiKey: 'sk-valid',
        })
      }).pipe(Effect.provide(ByokExecutorService.layer)),
    )

    expect(mockUpsertOrgProviderApiKey).toHaveBeenCalledWith({
      organizationId: 'org-1',
      providerId: 'openai',
      apiKey: 'sk-valid',
    })
    expect(result.providerKeyStatus).toEqual({
      openai: true,
      anthropic: false,
    })
  })

  it('removes provider key and updates provider status snapshot', async () => {
    const { ByokExecutorService } = await import('./byok-executor.service')

    mockCanUseOrganizationProviderKeys.mockReturnValue(true)
    mockGetOrgPolicy.mockResolvedValue(undefined)
    mockReadOrgProviderApiKeyStatus.mockResolvedValue({
      openai: true,
      anthropic: true,
    })
    mockDeleteOrgProviderApiKey.mockResolvedValue(undefined)
    mockUpsertOrgPolicy.mockResolvedValue(undefined)

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ByokExecutorService
        return yield* service.executeUpdate('org-2', {
          action: 'remove_provider_api_key',
          providerId: 'openai',
        })
      }).pipe(Effect.provide(ByokExecutorService.layer)),
    )

    expect(mockDeleteOrgProviderApiKey).toHaveBeenCalledWith({
      organizationId: 'org-2',
      providerId: 'openai',
    })
    expect(result.providerKeyStatus).toEqual({
      openai: false,
      anthropic: true,
    })
  })

  it('returns a typed feature-disabled error when BYOK feature flag is off', async () => {
    const { ByokExecutorService } = await import('./byok-executor.service')

    mockCanUseOrganizationProviderKeys.mockReturnValue(false)

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ByokExecutorService
          return yield* service.executeUpdate('org-3', {
            action: 'remove_provider_api_key',
            providerId: 'anthropic',
          })
        }).pipe(Effect.provide(ByokExecutorService.layer)),
      ),
    ).rejects.toMatchObject({
      _tag: 'ByokFeatureDisabledError',
    })
  })
})
