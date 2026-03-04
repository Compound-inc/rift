import { betterAuth } from 'better-auth'
import { anonymous } from 'better-auth/plugins/anonymous'
import { organization } from 'better-auth/plugins/organization'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { Pool } from 'pg'

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}.`,
    )
  }
  return value
}

function resolveAuthBaseURL(): string {
  const raw = process.env.BETTER_AUTH_URL?.trim()
  if (!raw) {
    throw new Error(
      'Missing BETTER_AUTH_URL. Configure apps/start/.env before starting auth.',
    )
  }
  return raw.replace(/\/+$/, '')
}

const connectionString = requireEnv('ZERO_UPSTREAM_DB')
const pool = new Pool({ connectionString })

/**
 * Better Auth is the only identity provider used by the app.
 * Database uses direct `pg.Pool` integration to avoid Kysely adapter requirements.
 */
export const auth = betterAuth({
  appName: 'Rift',
  baseURL: resolveAuthBaseURL(),
  basePath: '/api/auth',
  secret: requireEnv('BETTER_AUTH_SECRET'),
  database: pool,
  user: {
    changeEmail: {
      enabled: true,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
    anonymous({
      generateName: () => 'Guest User',
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        // Reassign app-owned rows so guest chat history survives account upgrade.
        const fromUserId = anonymousUser.user.id
        const toUserId = newUser.user.id
        const client = await pool.connect()

        try {
          await client.query('BEGIN')
          await client.query('UPDATE threads SET user_id = $1 WHERE user_id = $2', [
            toUserId,
            fromUserId,
          ])
          await client.query('UPDATE messages SET user_id = $1 WHERE user_id = $2', [
            toUserId,
            fromUserId,
          ])
          await client.query('UPDATE attachments SET user_id = $1 WHERE user_id = $2', [
            toUserId,
            fromUserId,
          ])
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }
      },
    }),
    tanstackStartCookies(),
  ],
})
