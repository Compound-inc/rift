import { summarizeOrgKnowledgeIndexError } from './org-knowledge'

export const PROJECT_SOURCES_UPLOAD_ACCEPT =
  '.pdf,.md,.markdown,.docx,.odt,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text'

export const summarizeProjectSourceIndexError = summarizeOrgKnowledgeIndexError

export type ProjectSourceListItem = {
  readonly id: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly status?: 'deleted' | 'uploaded'
  readonly vectorIndexedAt?: number
  readonly vectorError?: string
  readonly updatedAt: number
  readonly createdAt: number
}
