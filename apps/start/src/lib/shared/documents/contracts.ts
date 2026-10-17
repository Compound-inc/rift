import { estimateTokensFromText } from '@/lib/shared/chat-contracts/token-estimate'
import { z } from 'zod'

/** The bound is UTF-8 bytes, matching Postgres octet_length, not JS characters. */
export const DOCUMENT_MAX_BYTES = 200 * 1024
/** Tool budgets are server-owned and use the same estimate as prompt planning. */
export function documentModelBudgets(scope: DocumentScope) {
  return {
    rewriteTokens: Math.floor((scope.maxOutputTokens ?? 32_768) * 0.7),
    readTokens: scope.documentReadTokens ?? 32_768,
  }
}

/** Bound the entire JSON tool result, including metadata and the truncation marker.
 * The shared estimator accounts for Unicode and JSON escaping.
 */
export function documentModelView(
  content: string,
  metadata: object = {},
  tokenBudget = 32_768,
) {
  const totalBytes = new TextEncoder().encode(content).byteLength
  const result = (text: string, truncated: boolean) => ({
    content: text,
    truncated,
    totalBytes,
  })
  const fits = (value: ReturnType<typeof result>) =>
    estimateTokensFromText(
      JSON.stringify({ ok: true, ...metadata, ...value }),
    ) <= tokenBudget
  if (fits(result(content, false))) return result(content, false)
  const marker =
    '\n\n[Document truncated. Read budget reached. Do not rewrite this truncated view; edit directly or propose changes in chat.]'
  // Search code-point boundaries, preserving Unicode and accounting for JSON escapes.
  const points = Array.from(content)
  let low = 0
  let high = points.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (fits(result(points.slice(0, middle).join('') + marker, true)))
      low = middle
    else high = middle - 1
  }
  return result(points.slice(0, low).join('') + marker, true)
}
export const documentContentSchema = z
  .string()
  .max(DOCUMENT_MAX_BYTES)
  .refine(
    (content) =>
      new TextEncoder().encode(content).byteLength <= DOCUMENT_MAX_BYTES,
    'Document content must be at most 200 KB',
  )
export const createDocumentSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['markdown', 'code']),
  language: z
    .string()
    .trim()
    .overwrite((value) => value.slice(0, 40))
    .max(40)
    .optional(),
  content: documentContentSchema,
})
export const documentIdSchema = z.strictObject({
  documentId: z.string().min(1).max(300),
})
export const updateDocumentSchema = documentIdSchema.extend({
  baseVersion: z.number().int().positive(),
  content: documentContentSchema,
})
/** One object is shared by all document tools in a step. z.custom preserves its
 * identity when the SDK validates each context, so sequential reads spend it once.
 */
export type DocumentReadBudget = {
  remainingTokens: number
  truncatedVersions?: Map<string, number>
  rewriteLimits?: Map<string, { version: number; maxRewriteTokens: number }>
  /** Project the next request after adding this result to the accumulated prompt. */
  projectRewriteTokens?: (resultTokens: number) => number
}
const documentReadBudgetSchema = z.custom<DocumentReadBudget>(
  (value) =>
    !!value &&
    typeof value === 'object' &&
    'remainingTokens' in value &&
    Number.isInteger(value.remainingTokens) &&
    Number(value.remainingTokens) >= 0,
)
export const documentScopeSchema = z.object({
  userId: z.string().min(1),
  threadId: z.string().min(1),
  organizationId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  documentReadTokens: z.number().int().nonnegative().optional(),
  documentReadBudget: documentReadBudgetSchema.optional(),
})
export type DocumentScope = z.infer<typeof documentScopeSchema>
export type DocumentSummary = {
  documentId: string
  title: string
  version: number
}
export type DocumentRecord = {
  id: string
  userId: string
  organizationId?: string | null
  threadId: string
  projectId?: string | null
  title: string
  kind: 'markdown' | 'code'
  language?: string | null
  currentVersion: number
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}
export type DocumentVersion = {
  documentId: string
  version: number
  content: string
  createdBy: 'assistant' | 'user'
  sourceMessageId?: string | null
  createdAt: number
}

/** Every access path checks the active organization as well as thread ownership. */
export function ownsDocument(
  document: DocumentRecord | undefined,
  scope: DocumentScope,
): document is DocumentRecord {
  return (
    !!document &&
    document.deletedAt == null &&
    document.userId === scope.userId &&
    document.threadId === scope.threadId &&
    (document.organizationId ?? undefined) === scope.organizationId
  )
}

export const DOCUMENT_TOOL_NAMES = [
  'create_document',
  'update_document',
  'read_document',
] as const

/** Only registered tools receive tenant context; provider-native tools keep their own context. */
export function documentToolsContext(
  scope: DocumentScope,
  activeTools: readonly string[],
): Record<string, DocumentScope> {
  return Object.fromEntries(
    DOCUMENT_TOOL_NAMES.filter((name) => activeTools.includes(name)).map(
      (name) => [name, scope],
    ),
  )
}
