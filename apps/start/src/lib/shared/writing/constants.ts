export const WRITING_PRODUCT_KEY = 'writing' as const
export const WRITING_DEFAULT_MODEL_ID = 'vercel-ai-gateway:openai/gpt-5.1-thinking' as const
export const WRITING_ROOT_PATH = '/' as const
export const WRITING_PROJECT_INSTRUCTION_PATH = '/agents.md' as const

export const WRITING_ALLOWED_FILE_EXTENSION = '.md' as const

export const WRITING_ENTRY_KINDS = ['file', 'folder'] as const
export type WritingEntryKind = (typeof WRITING_ENTRY_KINDS)[number]

export const WRITING_SNAPSHOT_SOURCES = ['user', 'ai', 'restore', 'system'] as const
export type WritingSnapshotSource = (typeof WRITING_SNAPSHOT_SOURCES)[number]

export const WRITING_CHAT_STATUSES = ['active', 'archived'] as const
export type WritingChatStatus = (typeof WRITING_CHAT_STATUSES)[number]

export const WRITING_MESSAGE_STATUSES = ['pending', 'done', 'error'] as const
export type WritingMessageStatus = (typeof WRITING_MESSAGE_STATUSES)[number]

export const WRITING_CHANGE_SET_STATUSES = [
  'pending',
  'partially_applied',
  'applied',
  'rejected',
  'conflicted',
] as const
export type WritingChangeSetStatus = (typeof WRITING_CHANGE_SET_STATUSES)[number]

export const WRITING_CHANGE_OPERATIONS = [
  'create',
  'update',
  'delete',
  'move',
] as const
export type WritingChangeOperation = (typeof WRITING_CHANGE_OPERATIONS)[number]

export const WRITING_CHANGE_STATUSES = [
  'pending',
  'rejected',
  'applied',
  'conflicted',
] as const
export type WritingChangeStatus = (typeof WRITING_CHANGE_STATUSES)[number]

export const WRITING_HUNK_STATUSES = [
  'pending',
  'rejected',
  'applied',
  'conflicted',
] as const
export type WritingHunkStatus = (typeof WRITING_HUNK_STATUSES)[number]
