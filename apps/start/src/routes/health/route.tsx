import { createFileRoute } from '@tanstack/react-router'

/**
 * Deployment healthcheck endpoint.
 */
export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
      HEAD: () => {
        return new Response(null, { status: 200 })
      },
    },
  },
})
