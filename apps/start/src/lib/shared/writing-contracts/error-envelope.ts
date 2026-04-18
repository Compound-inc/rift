import type {
  StandardApiErrorEnvelope,
} from '@/lib/backend/server-effect'
import type { WritingErrorCode } from './error-codes'
import type {
  WritingErrorI18nKey,
  WritingErrorI18nParams,
} from './error-i18n'

export type WritingApiErrorEnvelope = StandardApiErrorEnvelope<
  WritingErrorCode,
  WritingErrorI18nKey,
  WritingErrorI18nParams | undefined,
  {
    readonly tag: string
    readonly message?: string
    readonly cause?: string
    readonly issue?: string
    readonly projectId?: string
    readonly chatId?: string
    readonly path?: string
    readonly toolName?: string
    readonly expectedHeadSnapshotId?: string
    readonly actualHeadSnapshotId?: string
  }
>
