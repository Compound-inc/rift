import { describe, expect, it } from 'vitest'
import { WritingErrorCode } from './error-codes'
import { classifyWritingError } from './error-classification'
import {
  WritingConflictError,
  WritingPersistenceError,
} from './errors'
import { WritingErrorI18nKey } from '@/lib/shared/writing-contracts/error-i18n'

describe('classifyWritingError', () => {
  it('marks conflicts as retryable signal-level failures', () => {
    const classification = classifyWritingError(
      new WritingConflictError({
        message: 'Head changed',
        requestId: 'req-conflict',
        projectId: 'project-1',
      }),
    )

    expect(classification.status).toBe(409)
    expect(classification.code).toBe(WritingErrorCode.Conflict)
    expect(classification.i18nKey).toBe(WritingErrorI18nKey.Conflict)
    expect(classification.retryable).toBe(true)
    expect(classification.captureMode).toBe('signal')
  })

  it('treats persistence failures as exception-level server errors', () => {
    const classification = classifyWritingError(
      new WritingPersistenceError({
        message: 'Failed to save',
        requestId: 'req-db',
        cause: 'sqlite timeout',
      }),
    )

    expect(classification.status).toBe(500)
    expect(classification.code).toBe(WritingErrorCode.PersistenceFailed)
    expect(classification.i18nKey).toBe(WritingErrorI18nKey.PersistenceFailed)
    expect(classification.captureMode).toBe('exception')
  })
})
