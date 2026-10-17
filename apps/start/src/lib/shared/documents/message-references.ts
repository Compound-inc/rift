import { DOCUMENT_TOOL_NAMES } from './contracts'
import type { UIMessage } from 'ai'
import { z } from 'zod'

const referenceSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  version: z.number().int().positive(),
  toolName: z.enum(['create_document', 'update_document']),
  toolCallId: z.string(),
})
export type DocumentReference = z.infer<typeof referenceSchema>
export function isDocumentToolPart(part: UIMessage['parts'][number]): boolean {
  return DOCUMENT_TOOL_NAMES.some(
    (name) =>
      part.type === `tool-${name}` ||
      (part.type === 'dynamic-tool' && part.toolName === name),
  )
}

/** Completed writes provide stable history references; bodies stay in document_versions. */
export function documentReferenceFromChunk(
  chunk: unknown,
): DocumentReference | undefined {
  if (!chunk || typeof chunk !== 'object') return undefined
  const value = chunk as Record<string, unknown>
  if (value.type !== 'tool-result') return undefined
  const parsed = referenceSchema.safeParse({
    ...(value.output && typeof value.output === 'object' ? value.output : {}),
    toolName: value.toolName,
    toolCallId: value.toolCallId,
  })
  return parsed.success ? parsed.data : undefined
}
export function documentReferenceText(reference: {
  documentId: string
  title: string
  version: number
}): string {
  return `Document ${JSON.stringify(reference.title)} [${reference.documentId}], version ${reference.version}. Use read_document for current content.`
}

/** Completed document tool history becomes plain references, including read results. */
export function compactDocumentHistory(
  messages: readonly UIMessage[],
): UIMessage[] {
  return messages.map((message) =>
    !message.parts.some(isDocumentToolPart)
      ? message
      : {
          ...message,
          parts: message.parts.map((part) => {
            if (!isDocumentToolPart(part)) return part
            const value = part as {
              input?: { documentId?: string }
              output?: { documentId?: string; title?: string; version?: number }
            }
            return {
              type: 'text' as const,
              text: value.output?.documentId
                ? documentReferenceText({
                    documentId: value.output.documentId,
                    title: value.output.title ?? '',
                    version: value.output.version ?? 1,
                  })
                : `Document operation [${value.input?.documentId ?? 'unfinished'}].`,
            }
          }),
        },
  )
}

/** Message reconciliation must notice completed cards even when text is unchanged. */
export function documentReferenceFingerprint(
  parts: UIMessage['parts'],
): string {
  return JSON.stringify(
    parts.flatMap((part) => {
      if (!isDocumentToolPart(part)) return []
      const value = part as {
        toolName?: string
        toolCallId?: string
        output?: unknown
      }
      const toolName =
        part.type === 'dynamic-tool' ? value.toolName : part.type.slice(5)
      const reference = documentReferenceFromChunk({
        type: 'tool-result',
        toolName,
        toolCallId: value.toolCallId,
        output: value.output,
      })
      return reference ? [reference] : []
    }),
  )
}

/** Extract completed writes from the shared, bounded messages.parts records. */
export function documentReferencesFromParts(
  value: unknown,
): DocumentReference[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((part) => {
    if (!part || typeof part !== 'object') return []
    const reference = documentReferenceFromChunk({
      ...part,
      type: 'tool-result',
      toolName:
        part.type === 'dynamic-tool'
          ? part.toolName
          : String(part.type).slice(5),
      output: part.state === 'output-available' ? part.output : undefined,
    })
    return reference ? [reference] : []
  })
}

/** Bodies live only in document_versions. Keep ids and presentation metadata on messages. */
export function documentToolDisplayData(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    [
      'ok',
      'documentId',
      'title',
      'version',
      'baseVersion',
      'kind',
      'language',
      'error',
      'truncated',
      'totalBytes',
      'rewritable',
      'maxRewriteTokens',
    ]
      .filter((key) => record[key] !== undefined)
      .map((key) => [key, record[key]]),
  )
}
