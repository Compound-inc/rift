import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type StoredRow = {
  organizationId: string
  providerId: 'openai' | 'anthropic'
  ciphertext: string
  iv: string
  authTag: string
  keyVersion: number
}

const rows = new Map<string, StoredRow>()

function rowKey(organizationId: string, providerId: string) {
  return `${organizationId}:${providerId}`
}

vi.mock('pg', () => {
  const executeQuery = async <T = unknown>(
    text: string,
    values: readonly unknown[] = [],
  ) => {
    if (text.includes('insert into org_provider_api_key')) {
      const organizationId = String(values[1])
      const providerId = String(values[2]) as 'openai' | 'anthropic'
      rows.set(rowKey(organizationId, providerId), {
        organizationId,
        providerId,
        ciphertext: String(values[3]),
        iv: String(values[4]),
        authTag: String(values[5]),
        keyVersion: Number(values[6]),
      })
      return { rows: [] as T[] }
    }

    if (
      text.includes('from org_provider_api_key')
      && text.includes('provider_id = $2')
      && text.includes('limit 1')
    ) {
      const organizationId = String(values[0])
      const providerId = String(values[1])
      const row = rows.get(rowKey(organizationId, providerId))
      return {
        rows: row
          ? [
              {
                providerId: row.providerId,
                ciphertext: row.ciphertext,
                iv: row.iv,
                authTag: row.authTag,
                keyVersion: row.keyVersion,
              },
            ]
          : [],
      } as { rows: T[] }
    }

    if (
      text.includes('select provider_id as "providerId"')
      && text.includes('where organization_id = $1')
    ) {
      const organizationId = String(values[0])
      const providerRows = [...rows.values()]
        .filter((row) => row.organizationId === organizationId)
        .map((row) => ({ providerId: row.providerId }))
      return { rows: providerRows as T[] }
    }

    if (text.includes('delete from org_provider_api_key')) {
      const organizationId = String(values[0])
      const providerId = String(values[1])
      rows.delete(rowKey(organizationId, providerId))
      return { rows: [] as T[] }
    }

    throw new Error(`Unexpected query: ${text}`)
  }

  class MockPoolClient {
    query<T = unknown>(
      textOrConfig: string | { text: string; values?: readonly unknown[] },
      valuesOrCallback?:
        | readonly unknown[]
        | ((error: Error | null, result?: { rows: T[] }) => void),
      callback?: (error: Error | null, result?: { rows: T[] }) => void,
    ) {
      const text =
        typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text
      const values = Array.isArray(valuesOrCallback)
        ? valuesOrCallback
        : (textOrConfig as { values?: readonly unknown[] }).values ?? []
      const done =
        typeof valuesOrCallback === 'function' ? valuesOrCallback : callback

      const promise = executeQuery<T>(text, values)

      if (done) {
        void promise.then(
          (result) => done(null, result),
          (error) => done(error instanceof Error ? error : new Error(String(error))),
        )
        return
      }

      return promise
    }

    once() {
      return this
    }

    on() {
      return this
    }

    off() {
      return this
    }

    release() {
      return
    }
  }

  class MockPool {
    readonly options = {
      connectionString: process.env.ZERO_UPSTREAM_DB,
      host: 'example.local',
      port: 5432,
      database: 'rift',
      user: 'test-user',
      application_name: 'vitest',
      types: undefined,
    }

    query<T = unknown>(
      text: string,
      values: readonly unknown[] = [],
      callback?: (error: Error | null, result?: { rows: T[] }) => void,
    ) {
      const promise = executeQuery<T>(text, values)

      if (callback) {
        void promise.then(
          (result) => callback(null, result),
          (error) =>
            callback(error instanceof Error ? error : new Error(String(error))),
        )
        return
      }

      return promise
    }

    connect(
      callback: (
        error: Error | null,
        client?: MockPoolClient,
        release?: (error?: Error) => void,
      ) => void,
    ) {
      const client = new MockPoolClient()
      callback(null, client, () => undefined)
    }

    async end() {
      return
    }
  }

  return { Pool: MockPool }
})

describe('provider-keys', () => {
  beforeEach(async () => {
    rows.clear()
    vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://example.local/rift')
    vi.stubEnv(
      'BYOK_ENCRYPTION_KEY_B64',
      Buffer.alloc(32, 7).toString('base64'),
    )
    const mod = await import('./provider-key-store')
    mod.__resetByokKeyModuleForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('encrypts/decrypts roundtrip without persisting plaintext', async () => {
    const mod = await import('./provider-key-store')

    await mod.upsertOrgProviderApiKey({
      organizationId: 'org-roundtrip',
      providerId: 'openai',
      apiKey: 'sk-openai-secret',
    })

    const stored = rows.get('org-roundtrip:openai')
    expect(stored).toBeDefined()
    expect(stored?.ciphertext).not.toContain('sk-openai-secret')

    const key = await mod.readOrgProviderApiKey({
      organizationId: 'org-roundtrip',
      providerId: 'openai',
    })

    expect(key).toBe('sk-openai-secret')
  })

  it('fails decryption for invalid auth tag', async () => {
    const mod = await import('./provider-key-store')
    const encrypted = mod.__encryptForTests('sk-ant-secret')

    await expect(
      Promise.resolve().then(() =>
        mod.__decryptForTests({
          ...encrypted,
          keyVersion: mod.BYOK_CRYPTO_CONSTANTS.KEY_VERSION,
          authTagB64: Buffer.from('broken-tag').toString('base64'),
        }),
      ),
    ).rejects.toThrow()
  })

  it('fails fast when encryption env key is missing', async () => {
    const mod = await import('./provider-key-store')
    mod.__resetByokKeyModuleForTests()
    vi.stubEnv('BYOK_ENCRYPTION_KEY_B64', '')

    await expect(
      mod.upsertOrgProviderApiKey({
        organizationId: 'org-missing-key',
        providerId: 'openai',
        apiKey: 'sk-valid',
      }),
    ).rejects.toThrow('BYOK_ENCRYPTION_KEY_B64')
  })

  it('fails fast when encryption env key length is invalid', async () => {
    const mod = await import('./provider-key-store')
    mod.__resetByokKeyModuleForTests()
    vi.stubEnv(
      'BYOK_ENCRYPTION_KEY_B64',
      Buffer.from('short-key').toString('base64'),
    )

    await expect(
      mod.upsertOrgProviderApiKey({
        organizationId: 'org-invalid-key',
        providerId: 'openai',
        apiKey: 'sk-valid',
      }),
    ).rejects.toThrow('exactly 32 bytes')
  })

  it('supports upsert/read/delete and status snapshots', async () => {
    const mod = await import('./provider-key-store')

    await mod.upsertOrgProviderApiKey({
      organizationId: 'org-status',
      providerId: 'openai',
      apiKey: 'sk-openai-live',
    })
    await mod.upsertOrgProviderApiKey({
      organizationId: 'org-status',
      providerId: 'anthropic',
      apiKey: 'sk-ant-live',
    })

    expect(await mod.readOrgProviderApiKeyStatus('org-status')).toEqual({
      openai: true,
      anthropic: true,
    })

    await mod.deleteOrgProviderApiKey({
      organizationId: 'org-status',
      providerId: 'openai',
    })

    expect(await mod.readOrgProviderApiKeyStatus('org-status')).toEqual({
      openai: false,
      anthropic: true,
    })
    expect(
      await mod.readOrgProviderApiKey({
        organizationId: 'org-status',
        providerId: 'openai',
      }),
    ).toBeUndefined()
  })

  it('enforces provider-specific key format validation', async () => {
    const mod = await import('./provider-key-store')
    const shared = await import('@/lib/shared/model-policy/provider-keys')

    expect(
      shared.validateProviderApiKeyFormat({
        providerId: 'openai',
        apiKey: 'sk-123',
      }).ok,
    ).toBe(true)

    expect(
      shared.validateProviderApiKeyFormat({
        providerId: 'openai',
        apiKey: 'bad-openai-key',
      }).ok,
    ).toBe(false)

    expect(
      shared.validateProviderApiKeyFormat({
        providerId: 'anthropic',
        apiKey: 'sk-ant-123',
      }).ok,
    ).toBe(true)

    expect(
      shared.validateProviderApiKeyFormat({
        providerId: 'anthropic',
        apiKey: 'sk-123',
      }).ok,
    ).toBe(false)

    await expect(
      mod.upsertOrgProviderApiKey({
        organizationId: 'org-invalid-format',
        providerId: 'anthropic',
        apiKey: 'sk-123',
      }),
    ).rejects.toThrow('sk-ant-')
  })
})
