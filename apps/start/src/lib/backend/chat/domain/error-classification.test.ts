import { describe, expect, it } from 'vitest'
import { classifyChatError } from './error-classification'
import {
  BranchVersionConflictError,
  InvalidRequestError,
  ModelPolicyDeniedError,
  MessagePersistenceError,
} from './errors'

describe('classifyChatError', () => {
  it('does not send routine file-upload denials to PostHog', () => {
    const classification = classifyChatError(
      new InvalidRequestError({
        message: 'File uploads are not available on the current plan',
        requestId: 'req-upload',
        issue: 'feature_denied:chat.fileUpload',
      }),
    )

    expect(classification.captureMode).toBe('none')
  })

  it('captures client-guardrail model bypasses as PostHog signals', () => {
    const classification = classifyChatError(
      new ModelPolicyDeniedError({
        message: 'Selected model is not allowed for this request',
        requestId: 'req-model',
        modelId: 'openai/gpt-5-mini',
        threadId: 'thread-1',
        reason: 'free_tier_model_denied:openai/gpt-5-mini',
      }),
    )

    expect(classification.captureMode).toBe('signal')
  })

  it('treats branch conflicts as PostHog exceptions', () => {
    const classification = classifyChatError(
      new BranchVersionConflictError({
        message: 'Branch version mismatch',
        requestId: 'req-branch',
        threadId: 'thread-1',
        expectedBranchVersion: 2,
        actualBranchVersion: 3,
      }),
    )

    expect(classification.captureMode).toBe('exception')
  })

  it('keeps true persistence faults as PostHog exceptions', () => {
    const classification = classifyChatError(
      new MessagePersistenceError({
        message: 'Failed to write chat message',
        requestId: 'req-db',
        threadId: 'thread-1',
        cause: 'postgres timeout',
      }),
    )

    expect(classification.captureMode).toBe('exception')
  })
})
