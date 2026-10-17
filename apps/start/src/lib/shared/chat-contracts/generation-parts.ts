import { isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'
import type { ReadonlyJSONValue } from '@rocicorp/zero'
import { boundedJson } from './bounded-json'
import { safeText } from './safe-text'

export type PersistedSource =
  | {
      readonly type: 'source-url'
      readonly sourceId: string
      readonly url: string
      readonly title?: string
    }
  | {
      readonly type: 'source-document'
      readonly sourceId: string
      readonly mediaType: string
      readonly title: string
      readonly filename?: string
    }

export type PersistedToolPart = {
  readonly type: 'dynamic-tool'
  readonly toolCallId: string
  readonly toolName: string
  readonly input: ReadonlyJSONValue
  readonly providerExecuted?: boolean
} & (
  | {
      readonly state: 'input-available'
      readonly output?: undefined
      readonly errorText?: undefined
    }
  | {
      readonly state: 'output-available'
      readonly output: ReadonlyJSONValue
      readonly errorText?: undefined
    }
  | {
      readonly state: 'output-error'
      readonly errorText: string
      readonly output?: undefined
    }
)

export function httpSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4_096) return undefined
  try {
    const url = new URL(safeText(value))
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

/** Accept old URL rows as well as v7 document/URL parts. Never retain provider metadata. */
export function normalizeSources(value: unknown): PersistedSource[] {
  if (!Array.isArray(value)) return []
  const byId = new Map<string, PersistedSource>()
  const urls = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.sourceId !== 'string')
      continue
    const sourceId = safeText(item.sourceId, 256)
    if (byId.has(sourceId)) continue
    if (item.type === 'source-document') {
      if (typeof item.title !== 'string' || typeof item.mediaType !== 'string')
        continue
      byId.set(sourceId, {
        type: 'source-document',
        sourceId,
        title: safeText(item.title, 512),
        mediaType: safeText(item.mediaType, 128),
        ...(typeof item.filename === 'string'
          ? { filename: safeText(item.filename, 512) }
          : {}),
      })
    } else {
      const url = httpSourceUrl(item.url)
      if (!url) continue
      // Fragments identify locations within one source, not separate sources.
      const canonical = new URL(url)
      canonical.hash = ''
      if (urls.has(canonical.href)) continue
      urls.add(canonical.href)
      byId.set(sourceId, {
        type: 'source-url',
        sourceId,
        url,
        ...(typeof item.title === 'string'
          ? { title: safeText(item.title, 512) }
          : {}),
      })
    }
  }
  return [...byId.values()].slice(0, 128)
}

/** Search results keep attribution/counts, never full page content. */
function summarizeOutput(
  toolName: string,
  output: unknown,
): ReadonlyJSONValue | undefined {
  if (!/search|fetch|browse/i.test(toolName)) return boundedJson(output, 8_192)
  const sites: { url: string; title?: string }[] = []
  const root =
    output && typeof output === 'object'
      ? (output as Record<string, unknown>)
      : {}
  const action =
    root.action && typeof root.action === 'object'
      ? (root.action as Record<string, unknown>)
      : root
  const query = action.queries ?? action.query ?? root.query
  const seen = new WeakSet<object>()
  let visited = 0
  function collect(value: unknown, depth: number): void {
    if (
      !value ||
      typeof value !== 'object' ||
      depth > 5 ||
      seen.has(value) ||
      visited++ > 256
    )
      return
    seen.add(value)
    if (Array.isArray(value)) {
      value.slice(0, 64).forEach((entry) => collect(entry, depth + 1))
      return
    }
    const item = value as Record<string, unknown>
    const url = httpSourceUrl(item.url)
    if (url && !sites.some((site) => site.url === url)) {
      sites.push({
        url,
        ...(typeof item.title === 'string'
          ? { title: safeText(item.title, 256) }
          : {}),
      })
    }
    for (const key of ['results', 'sources', 'content', 'action', 'data'])
      collect(item[key], depth + 1)
  }
  collect(output, 0)
  const previousCount =
    output &&
    typeof output === 'object' &&
    'siteCount' in output &&
    typeof output.siteCount === 'number' &&
    Number.isFinite(output.siteCount)
      ? output.siteCount
      : 0
  return boundedJson(
    {
      query,
      siteCount: Math.max(sites.length, previousCount),
      sources: sites.slice(0, 32),
    },
    8_192,
  )
}

/**
 * Persist only tool display data. Text/reasoning have dedicated columns. A shared
 * byte budget caps the whole tool list, including many individually small calls.
 */
export function persistToolParts(
  parts: UIMessage['parts'],
): PersistedToolPart[] {
  const result: PersistedToolPart[] = []
  let remaining = 131_070
  for (const part of parts) {
    if (!isToolUIPart(part) || result.length >= 64) continue
    const state =
      part.state === 'output-available'
        ? 'output-available'
        : part.state === 'output-error' || part.state === 'output-denied'
          ? 'output-error'
          : 'input-available'
    const stored: PersistedToolPart = {
      type: 'dynamic-tool',
      toolCallId: safeText(part.toolCallId, 256),
      toolName: safeText(
        part.type === 'dynamic-tool' ? part.toolName : part.type.slice(5),
        128,
      ),
      input: boundedJson(part.input, 16_384) ?? null,
      ...(typeof part.providerExecuted !== 'boolean'
        ? {}
        : { providerExecuted: part.providerExecuted }),
      ...(state === 'output-available'
        ? {
            state,
            output:
              summarizeOutput(
                part.type === 'dynamic-tool'
                  ? part.toolName
                  : part.type.slice(5),
                part.output,
              ) ?? null,
          }
        : state === 'output-error'
          ? {
              state,
              errorText: safeText(
                ('errorText' in part && typeof part.errorText === 'string'
                  ? part.errorText
                  : undefined) ?? 'Tool execution failed',
                1_024,
              ),
            }
          : { state }),
    }
    const size = new TextEncoder().encode(JSON.stringify(stored)).byteLength + 1
    if (size > remaining) break
    remaining -= size
    result.push(stored)
  }
  return result
}

/** Restore only validated display parts, including interrupted tool activity. */
export function rehydrateToolParts(value: unknown): UIMessage['parts'] {
  if (!Array.isArray(value)) return []
  const valid = value
    .slice(0, 64)
    .filter(
      (part) =>
        part &&
        part.type === 'dynamic-tool' &&
        typeof part.toolCallId === 'string' &&
        typeof part.toolName === 'string' &&
        ['input-available', 'output-available', 'output-error'].includes(
          part.state,
        ),
    )
  return persistToolParts(valid as UIMessage['parts']) as UIMessage['parts']
}
