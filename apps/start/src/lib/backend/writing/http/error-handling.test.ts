import { describe, expect, it } from 'vitest'
import { WritingErrorCode } from '../domain/error-codes'
import {
  WritingConflictError,
  WritingPersistenceError,
} from '../domain/errors'
import { toWritingErrorResponse } from './error-response'
import { formatWritingServerActionError } from './server-action-failure'
import { WritingErrorI18nKey } from '@/lib/shared/writing-contracts/error-i18n'

describe('writing http error handling', () => {
  it('includes request id, tag, and cause in server action errors', () => {
    const error = new WritingPersistenceError({
      message: 'Failed to create writing project',
      requestId: 'req-create-project',
      cause: 'Folder paths cannot include file extensions',
    })

    const formatted = formatWritingServerActionError({
      error,
      requestId: 'req-create-project',
      defaultMessage: 'Failed to create writing project',
      operation: 'createWritingProject',
    })

    expect(formatted).toContain('Failed to create writing project')
    expect(formatted).toContain('requestId: req-create-project')
    expect(formatted).toContain('tag: WritingPersistenceError')
    expect(formatted).toContain('Cause: Folder paths cannot include file extensions')
  })

  it('returns a structured route envelope for tagged domain conflicts', async () => {
    const response = toWritingErrorResponse(
      new WritingConflictError({
        message: 'Writing project head changed before the save completed',
        requestId: 'req-conflict',
        projectId: 'project-123',
        path: '/README.md',
        expectedHeadSnapshotId: 'snapshot-a',
        actualHeadSnapshotId: 'snapshot-b',
      }),
      'fallback-request',
    )

    expect(response.status).toBe(409)

    const payload = (await response.json()) as {
      requestId: string
      error: {
        code: string
        i18nKey: string
        requestId: string
        retryable: boolean
      }
      details?: { path?: string; expectedHeadSnapshotId?: string; actualHeadSnapshotId?: string }
    }

    expect(payload.requestId).toBe('req-conflict')
    expect(payload.error.code).toBe(WritingErrorCode.Conflict)
    expect(payload.error.i18nKey).toBe(WritingErrorI18nKey.Conflict)
    expect(payload.error.requestId).toBe('req-conflict')
    expect(payload.error.retryable).toBe(true)
    expect(payload.details?.path).toBe('/README.md')
    expect(payload.details?.expectedHeadSnapshotId).toBe('snapshot-a')
    expect(payload.details?.actualHeadSnapshotId).toBe('snapshot-b')
  })
})
