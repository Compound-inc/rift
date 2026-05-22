export interface Env {
  AI: Ai
  INTERNAL_TOKEN: string
}

type ConvertRequest = {
  fileUrl?: unknown
  fileName?: unknown
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function getBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null
  const match = headerValue.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}

// Extract just the host from a URL for safe logging. The full `fileUrl` may
// be a presigned URL whose query string is a credential, so we never log it.
function safeHost(rawUrl: string): string {
  try {
    return new URL(rawUrl).host
  } catch {
    return '<invalid-url>'
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method !== 'POST' || url.pathname !== '/convert') {
      return jsonResponse({ error: 'Not found' }, 404)
    }

    const providedToken = getBearerToken(request.headers.get('authorization'))
    if (!providedToken || providedToken !== env.INTERNAL_TOKEN) {
      console.warn('convert: unauthorized request')
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    let body: ConvertRequest
    try {
      body = (await request.json()) as ConvertRequest
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : ''
    const fileName =
      typeof body.fileName === 'string' ? body.fileName.trim() : 'document.pdf'
    if (!fileUrl) {
      return jsonResponse({ error: 'fileUrl is required' }, 400)
    }

    const startedAt = Date.now()
    console.log('convert: start', { fileName, host: safeHost(fileUrl) })

    let sourceResponse: Response
    try {
      sourceResponse = await fetch(fileUrl)
    } catch (err) {
      console.error('convert: source fetch threw', {
        fileName,
        host: safeHost(fileUrl),
        error: err instanceof Error ? err.message : String(err),
      })
      return jsonResponse({ error: 'Failed to fetch source file' }, 502)
    }

    if (!sourceResponse.ok) {
      console.warn('convert: source fetch non-ok', {
        fileName,
        host: safeHost(fileUrl),
        status: sourceResponse.status,
      })
      return jsonResponse({ error: 'Failed to fetch source file' }, 400)
    }

    const blob = await sourceResponse.blob()

    let result: Awaited<ReturnType<Ai['toMarkdown']>>
    try {
      result = await env.AI.toMarkdown({
        name: fileName,
        blob,
      })
    } catch (err) {
      console.error('convert: AI.toMarkdown threw', {
        fileName,
        size: blob.size,
        error: err instanceof Error ? err.message : String(err),
      })
      return jsonResponse({ error: 'Conversion failed' }, 500)
    }

    if (result.format === 'error') {
      console.error('convert: AI.toMarkdown returned error', {
        fileName,
        size: blob.size,
        error: result.error,
      })
      return jsonResponse({ error: result.error }, 422)
    }

    console.log('convert: ok', {
      fileName,
      mimeType: result.mimeType,
      tokens: result.tokens ?? 0,
      durationMs: Date.now() - startedAt,
    })

    return jsonResponse({
      name: result.name,
      mimeType: result.mimeType,
      tokens: result.tokens ?? 0,
      markdown: result.data,
    })
  },
}
