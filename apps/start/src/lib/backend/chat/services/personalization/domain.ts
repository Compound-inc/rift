import { Schema } from 'effect'

export class MemoryError extends Schema.TaggedErrorClass<MemoryError>()(
  'MemoryError',
  {
    message: Schema.String,
    operation: Schema.String,
  },
) {}

export type MemoryScope = {
  userId: string
  organizationId: string
  generation?: string
}
export type MemoryItem = { id: string; text: string }
export type MemoryRecall = { profile: MemoryItem[]; memories: MemoryItem[] }
export const EMPTY_RECALL: MemoryRecall = { profile: [], memories: [] }
export type MemoryPage = {
  memories: MemoryItem[]
  page: number
  totalPages: number
}
