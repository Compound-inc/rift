import { describe, expect, it } from 'vitest'
import {
  type BackendErrorClassification,
  formatServerActionErrorMessage,
  getBackendErrorRequestId,
  getBackendErrorTag,
  isTaggedBackendError,
  resolveBackendErrorMetadata,
} from './error-core'

function makeClassification(
  input: BackendErrorClassification,
): BackendErrorClassification {
  return input
}

describe('server-effect error core', () => {
  it('detects tagged backend errors and preserves their request ids', () => {
    const error = {
      _tag: 'ExampleDomainError',
      requestId: 'req-example',
      message: 'Something failed',
      issue: 'bad input',
    }

    expect(isTaggedBackendError(error)).toBe(true)
    expect(getBackendErrorTag(error)).toBe('ExampleDomainError')
    expect(getBackendErrorRequestId(error, 'req-fallback')).toBe('req-example')
  })

  it('resolves shared metadata for tagged and unknown errors', () => {
    const tagged = resolveBackendErrorMetadata({
      error: {
        _tag: 'ExampleDomainError',
        requestId: 'req-tagged',
        message: 'Readable tagged message',
        issue: 'tagged issue',
      },
      fallbackRequestId: 'req-fallback',
      defaultMessage: 'fallback message',
      classifyTagged: () =>
        makeClassification({
          status: 409,
          retryable: true,
          severity: 'warn',
          captureMode: 'signal',
        }),
      classifyUnknown: () =>
        makeClassification({
          status: 500,
          retryable: false,
          severity: 'error',
          captureMode: 'exception',
        }),
      toReadableMessage: (error, fallback) =>
        typeof (error as { message?: unknown }).message === 'string'
          ? ((error as { message: string }).message)
          : (fallback ?? 'fallback'),
      toReadableCause: (error, fallback) =>
        typeof (error as { issue?: unknown }).issue === 'string'
          ? ((error as { issue: string }).issue)
          : (fallback ?? 'fallback'),
      extractContext: (error) => ({
        issue:
          typeof (error as { issue?: unknown }).issue === 'string'
            ? (error as { issue: string }).issue
            : undefined,
      }),
    })

    expect(tagged.isTaggedDomainError).toBe(true)
    expect(tagged.requestId).toBe('req-tagged')
    expect(tagged.classification.status).toBe(409)
    expect(tagged.context.issue).toBe('tagged issue')

    const unknown = resolveBackendErrorMetadata({
      error: new Error('boom'),
      fallbackRequestId: 'req-unknown',
      defaultMessage: 'fallback message',
      classifyTagged: () =>
        makeClassification({
          status: 400,
          retryable: false,
          severity: 'warn',
          captureMode: 'none',
        }),
      classifyUnknown: () =>
        makeClassification({
          status: 500,
          retryable: false,
          severity: 'error',
          captureMode: 'exception',
        }),
      toReadableMessage: (error, fallback) =>
        error instanceof Error ? error.message : (fallback ?? 'fallback'),
    })

    expect(unknown.isTaggedDomainError).toBe(false)
    expect(unknown.requestId).toBe('req-unknown')
    expect(unknown.classification.status).toBe(500)
  })

  it('formats server action messages with reusable annotations', () => {
    const message = formatServerActionErrorMessage({
      requestId: 'req-format',
      operation: 'saveDocument',
      readableMessage: 'Failed to save document',
      readableCause: 'snapshot conflict',
      errorTag: 'WritingConflictError',
      context: {
        projectId: 'project-1',
        path: '/draft.md',
        toolName: 'apply_patch',
      },
      contextLabels: {
        toolName: 'tool',
      },
    })

    expect(message).toContain('requestId: req-format')
    expect(message).toContain('tag: WritingConflictError')
    expect(message).toContain('projectId: project-1')
    expect(message).toContain('tool: apply_patch')
    expect(message).toContain('Cause: snapshot conflict')
  })
})
