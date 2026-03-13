/**
 * Stable discriminator stored on `attachments` rows that belong to the
 * organization-wide knowledge feature instead of chat message attachments.
 */
export const ORG_KNOWLEDGE_KIND = 'custom_rag'

/**
 * UI-facing upload contract for org knowledge. This intentionally stays narrow:
 * org-wide RAG only accepts markdown sources and PDFs, unlike general chat
 * uploads which allow many conversion-friendly document types.
 */
export const ORG_KNOWLEDGE_UPLOAD_ACCEPT = '.pdf,.md,.markdown,text/markdown,application/pdf'

/**
 * Converts infrastructure/vector-store failures into compact admin-safe
 * summaries. The raw errors can include internal paths or backend details that
 * should not be surfaced in the settings UI.
 */
export function summarizeOrgKnowledgeIndexError(input?: string | null): string | undefined {
  if (!input) return undefined
  const message = input.trim()
  if (!message) return undefined

  if (message.includes('timed out') || message.includes('AbortError')) {
    return 'Vector indexing timed out'
  }
  if (message.includes('Qdrant')) {
    return 'Vector store request failed'
  }
  if (message.includes('not configured')) {
    return 'Vector indexing is not configured'
  }
  if (message.includes('Failed to convert')) {
    return 'File conversion failed during indexing'
  }
  return 'Vector indexing failed'
}

export type OrgKnowledgeListItem = {
  readonly id: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly status?: 'deleted' | 'uploaded'
  readonly orgKnowledgeActive?: boolean
  readonly vectorIndexedAt?: number
  readonly vectorError?: string
  readonly updatedAt: number
  readonly createdAt: number
}
