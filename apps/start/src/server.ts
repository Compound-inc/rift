import { paraglideMiddleware } from './paraglide/server.js'
import handler from '@tanstack/react-start/server-entry'
import { captureUnhandledServerErrorInPostHog } from './lib/backend/chat/observability/posthog.server'

/**
 * Middleware to redirect www.rift.mx to rift.mx (naked domain).
 */
function wwwRedirectMiddleware(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url)

  // Check if the host starts with 'www.'
  if (url.host.startsWith('www.')) {
    // Remove the 'www.' prefix
    const newHost = url.host.slice(4) // 'www.' is 4 characters
    url.host = newHost

    // Return a 301 permanent redirect to the new URL
    return Promise.resolve(Response.redirect(url.toString(), 301))
  }

  // Not a www request, continue to the next middleware/handler
  return next()
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await wwwRedirectMiddleware(request, () =>
        paraglideMiddleware(request, () => handler.fetch(request)),
      )
    } catch (error) {
      await captureUnhandledServerErrorInPostHog({ error, request })
      throw error
    }
  },
}
