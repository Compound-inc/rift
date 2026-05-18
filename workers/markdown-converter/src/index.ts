export interface Env {
  AI: Ai
  INTERNAL_TOKEN: string
}

type ConvertRequest = {
  fileUrl?: unknown
  fileName?: unknown
  sourceBase64?: unknown
  mimeType?: unknown
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

async function resolveSourceBlob(input: {
  fileUrl: string
  sourceBase64: string
  mimeType: string
}): Promise<Blob | null> {
  const sourceResponse = await fetch(input.fileUrl).catch(() => null)
  if (sourceResponse?.ok) {
    return await sourceResponse.blob()
  }

  /**
   * Local development often signs app-origin proxy URLs like localhost, which
   * are unreachable from Cloudflare. The app includes the just-uploaded bytes
   * as a fallback so private-bucket conversion still works without exposing
   * the bucket or requiring a public tunnel.
   */
  if (!input.sourceBase64) return null

  const binary = atob(input.sourceBase64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], {
    type: input.mimeType || 'application/octet-stream',
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method !== 'POST' || url.pathname !== '/convert') {
      return jsonResponse({ error: 'Not found' }, 404)
    }

    const providedToken = getBearerToken(request.headers.get('authorization'))
    if (!providedToken || providedToken !== env.INTERNAL_TOKEN) {
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

    const sourceBase64 =
      typeof body.sourceBase64 === 'string' ? body.sourceBase64.trim() : ''
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : ''

    const blob = await resolveSourceBlob({ fileUrl, sourceBase64, mimeType })
    if (!blob) {
      return jsonResponse({ error: 'Failed to fetch source file' }, 400)
    }

    const result = await env.AI.toMarkdown({
      name: fileName,
      blob,
    })

    if (result.format === 'error') {
      return jsonResponse({ error: result.error }, 422)
    }

    return jsonResponse({
      name: result.name,
      mimeType: result.mimeType,
      tokens: result.tokens ?? 0,
      markdown: result.data,
    })
  },
}
