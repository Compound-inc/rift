import { createFileRoute } from '@tanstack/react-router'
import {
  DEFAULT_POSTHOG_HOST,
  POSTHOG_BROWSER_PROXY_PATH,
} from '@/lib/shared/observability/posthog-config'
import { isSelfHosted } from '@/utils/app-feature-flags'

function readTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function resolvePostHogHosts(): {
  readonly apiHost: string
  readonly assetHost: string
} {
  const apiUrl = new URL(readTrimmedEnv('POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST)
  const cloudAssetHost = apiUrl.hostname.replace(
    /(^|\.)(i\.posthog\.com)$/,
    '-assets.i.posthog.com',
  )

  return {
    apiHost: apiUrl.hostname,
    assetHost:
      cloudAssetHost === apiUrl.hostname ? apiUrl.hostname : cloudAssetHost,
  }
}

async function proxyPostHogRequest(request: Request): Promise<Response> {
  if (isSelfHosted || !readTrimmedEnv('POSTHOG_PROJECT_API_KEY')) {
    return new Response('Not Found', { status: 404 })
  }

  const { apiHost, assetHost } = resolvePostHogHosts()
  const originalUrl = new URL(request.url)
  const targetUrl = new URL(originalUrl)
  const isAssetRequest =
    originalUrl.pathname.startsWith(`${POSTHOG_BROWSER_PROXY_PATH}/static/`)
    || originalUrl.pathname.startsWith(`${POSTHOG_BROWSER_PROXY_PATH}/array/`)
  const targetHost = isAssetRequest ? assetHost : apiHost

  targetUrl.protocol = 'https:'
  targetUrl.hostname = targetHost
  targetUrl.port = ''
  targetUrl.pathname = targetUrl.pathname.replace(POSTHOG_BROWSER_PROXY_PATH, '')

  const headers = new Headers(request.headers)
  headers.set('host', targetHost)
  headers.delete('accept-encoding')
  headers.delete('authorization')
  headers.delete('cookie')

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? null
        : request.body,
    // Node's fetch requires duplex when forwarding a streaming request body.
    duplex: 'half',
  } as RequestInit)

  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export const Route = createFileRoute('/r/c/$')({
  server: {
    handlers: {
      GET: ({ request }) => proxyPostHogRequest(request),
      POST: ({ request }) => proxyPostHogRequest(request),
      OPTIONS: ({ request }) => proxyPostHogRequest(request),
    },
  },
})
