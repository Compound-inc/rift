import { createServerFn } from '@tanstack/react-start'

/**
 * Gets the application origin from BETTER_AUTH_URL environment variable.
 * Used to build absolute URLs for OpenGraph images and canonical links.
 *
 * @returns The base URL (e.g., "https://demo.rift.mx") or empty string if not configured
 */
export const getAppOrigin = createServerFn({
  method: 'GET',
}).handler(async () => {
  const betterAuthUrl = process.env.BETTER_AUTH_URL?.trim()

  if (!betterAuthUrl) {
    return ''
  }

  return betterAuthUrl.replace(/\/+$/, '')
})
