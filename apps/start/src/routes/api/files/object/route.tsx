import { createFileRoute } from '@tanstack/react-router'
import {
  UploadServiceError,
  uploadService,
  verifyStorageKeySignature,
} from '@/lib/backend/upload/upload.service'

const MAX_KEY_LENGTH = 512

/**
 * Lightweight key validation to avoid malformed proxy requests.
 */
function isLikelyValidStorageKey(key: string): boolean {
  if (key.length <= 0 || key.length > MAX_KEY_LENGTH) return false
  if (key.includes('..')) return false
  if (key.startsWith('/')) return false
  return true
}

/**
 * First-party object proxy for private S3-compatible buckets.
 *
 * The URL includes a signed key, so downstream services (like markdown
 * conversion workers) can fetch private objects without requiring user cookies.
 */
export const Route = createFileRoute('/api/files/object')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const key = url.searchParams.get('key')?.trim() ?? ''
        const expiresAt = Number.parseInt(
          url.searchParams.get('exp')?.trim() ?? '',
          10,
        )
        const signature = url.searchParams.get('sig')?.trim() ?? ''

        if (!isLikelyValidStorageKey(key)) {
          return new Response(JSON.stringify({ error: 'Invalid storage key' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (
          !signature ||
          !verifyStorageKeySignature({ key, expiresAt, signature })
        ) {
          return new Response(JSON.stringify({ error: 'Invalid or expired file signature' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          return await uploadService.readObjectByKey({ key })
        } catch (error) {
          if (error instanceof UploadServiceError) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: error.statusCode,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          console.error('[files.object] Failed to fetch object', {
            key,
            cause: error instanceof Error ? error.message : String(error),
          })

          return new Response(JSON.stringify({ error: 'Failed to fetch object' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
