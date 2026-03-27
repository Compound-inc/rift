import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { runUpstreamPostgresEffect } from '@/lib/backend/server-effect/runtime/upstream-postgres-runtime'
import {
  validateProviderApiKeyFormat,
} from '@/lib/shared/model-policy/provider-keys'
import type {
  ByokSupportedProviderId,
  OrgProviderKeyStatus,
} from '@/lib/shared/model-policy/provider-keys'

/**
 * Server-only encrypted storage adapter for organization provider API keys.
 * Plaintext keys only exist in memory long enough to encrypt/decrypt them.
 */
type EncryptedKeyRow = {
  providerId: ByokSupportedProviderId
  ciphertext: string
  iv: string
  authTag: string
  keyVersion: number
}

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY_BYTES = 32
const ENCRYPTION_IV_BYTES = 12
const KEY_VERSION = 1

let encryptionKeyCache: Buffer | undefined

export const readOrgProviderApiKeyEffect = Effect.fn(
  'ProviderKeyStore.readOrgProviderApiKey',
)(
  (input: {
    readonly organizationId: string
    readonly providerId: ByokSupportedProviderId
  }): Effect.Effect<string | undefined, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<EncryptedKeyRow>`
        select
          provider_id as "providerId",
          ciphertext,
          iv,
          auth_tag as "authTag",
          key_version as "keyVersion"
        from org_provider_api_key
        where organization_id = ${input.organizationId}
          and provider_id = ${input.providerId}
        limit 1
      `

      if (!row) {
        return undefined
      }

      return decryptApiKey({
        ciphertextB64: row.ciphertext,
        ivB64: row.iv,
        authTagB64: row.authTag,
        keyVersion: row.keyVersion,
      })
    }),
)

export async function readOrgProviderApiKey(input: {
  readonly organizationId: string
  readonly providerId: ByokSupportedProviderId
}): Promise<string | undefined> {
  return runUpstreamPostgresEffect(readOrgProviderApiKeyEffect(input))
}

export const readOrgProviderApiKeyStatusEffect = Effect.fn(
  'ProviderKeyStore.readOrgProviderApiKeyStatus',
)(
  (
    organizationId: string,
  ): Effect.Effect<OrgProviderKeyStatus, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const rows = yield* sql<{ providerId: string }>`
        select provider_id as "providerId"
        from org_provider_api_key
        where organization_id = ${organizationId}
      `
      const configured = new Set<string>(rows.map((row) => row.providerId))

      return {
        openai: configured.has('openai'),
        anthropic: configured.has('anthropic'),
      }
    }),
)

export async function readOrgProviderApiKeyStatus(
  organizationId: string,
): Promise<OrgProviderKeyStatus> {
  return runUpstreamPostgresEffect(
    readOrgProviderApiKeyStatusEffect(organizationId),
  )
}

export const upsertOrgProviderApiKeyEffect = Effect.fn(
  'ProviderKeyStore.upsertOrgProviderApiKey',
)(
  (input: {
    readonly organizationId: string
    readonly providerId: ByokSupportedProviderId
    readonly apiKey: string
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const validation = validateProviderApiKeyFormat({
        providerId: input.providerId,
        apiKey: input.apiKey,
      })

      if (!validation.ok) {
        return yield* Effect.fail(
          new Error(validation.message ?? 'Invalid provider API key'),
        )
      }

      const encrypted = encryptApiKey(validation.normalizedApiKey)
      const sql = yield* PgClient.PgClient
      const now = Date.now()

      yield* sql`
        insert into org_provider_api_key (
          id,
          organization_id,
          provider_id,
          ciphertext,
          iv,
          auth_tag,
          key_version,
          created_at,
          updated_at
        )
        values (
          ${crypto.randomUUID()},
          ${input.organizationId},
          ${input.providerId},
          ${encrypted.ciphertextB64},
          ${encrypted.ivB64},
          ${encrypted.authTagB64},
          ${KEY_VERSION},
          ${now},
          ${now}
        )
        on conflict (organization_id, provider_id) do update
        set ciphertext = excluded.ciphertext,
            iv = excluded.iv,
            auth_tag = excluded.auth_tag,
            key_version = excluded.key_version,
            updated_at = excluded.updated_at
      `
    }),
)

export async function upsertOrgProviderApiKey(input: {
  readonly organizationId: string
  readonly providerId: ByokSupportedProviderId
  readonly apiKey: string
}): Promise<void> {
  await runUpstreamPostgresEffect(upsertOrgProviderApiKeyEffect(input))
}

export const deleteOrgProviderApiKeyEffect = Effect.fn(
  'ProviderKeyStore.deleteOrgProviderApiKey',
)(
  (input: {
    readonly organizationId: string
    readonly providerId: ByokSupportedProviderId
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      yield* sql`
        delete from org_provider_api_key
        where organization_id = ${input.organizationId}
          and provider_id = ${input.providerId}
      `
    }),
)

export async function deleteOrgProviderApiKey(input: {
  readonly organizationId: string
  readonly providerId: ByokSupportedProviderId
}): Promise<void> {
  await runUpstreamPostgresEffect(deleteOrgProviderApiKeyEffect(input))
}

/**
 * Loads and validates the BYOK encryption key once per process.
 * The configured value must decode to exactly 32 bytes for AES-256-GCM.
 */
function getEncryptionKey(): Buffer {
  if (encryptionKeyCache) return encryptionKeyCache

  const raw = process.env.BYOK_ENCRYPTION_KEY_B64?.trim()
  if (!raw) {
    throw new Error('Missing required environment variable BYOK_ENCRYPTION_KEY_B64.')
  }

  let decoded: Buffer
  try {
    decoded = Buffer.from(raw, 'base64')
  } catch {
    throw new Error('BYOK_ENCRYPTION_KEY_B64 must be valid base64.')
  }

  if (decoded.length !== ENCRYPTION_KEY_BYTES) {
    throw new Error(
      `BYOK_ENCRYPTION_KEY_B64 must decode to exactly ${ENCRYPTION_KEY_BYTES} bytes.`,
    )
  }

  encryptionKeyCache = decoded
  return encryptionKeyCache
}

function encryptApiKey(apiKey: string): {
  readonly ciphertextB64: string
  readonly ivB64: string
  readonly authTagB64: string
} {
  const key = getEncryptionKey()
  const iv = randomBytes(ENCRYPTION_IV_BYTES)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return {
    ciphertextB64: ciphertext.toString('base64'),
    ivB64: iv.toString('base64'),
    authTagB64: authTag.toString('base64'),
  }
}

function decryptApiKey(input: {
  readonly ciphertextB64: string
  readonly ivB64: string
  readonly authTagB64: string
  readonly keyVersion: number
}): string {
  if (input.keyVersion !== KEY_VERSION) {
    throw new Error(`Unsupported BYOK key version: ${input.keyVersion}`)
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(input.ivB64, 'base64')
  if (iv.length !== ENCRYPTION_IV_BYTES) {
    throw new Error('Invalid BYOK key IV length.')
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(Buffer.from(input.authTagB64, 'base64'))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertextB64, 'base64')),
    decipher.final(),
  ])

  return plaintext.toString('utf8')
}

/**
 * Test-only reset hook for deterministic module state.
 */
export function __resetByokKeyModuleForTests() {
  encryptionKeyCache = undefined
}

/**
 * Test-only crypto helper.
 */
export function __encryptForTests(apiKey: string) {
  return encryptApiKey(apiKey)
}

/**
 * Test-only crypto helper.
 */
export function __decryptForTests(input: {
  readonly ciphertextB64: string
  readonly ivB64: string
  readonly authTagB64: string
  readonly keyVersion: number
}) {
  return decryptApiKey(input)
}

export const BYOK_CRYPTO_CONSTANTS = {
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_KEY_BYTES,
  ENCRYPTION_IV_BYTES,
  KEY_VERSION,
} as const
