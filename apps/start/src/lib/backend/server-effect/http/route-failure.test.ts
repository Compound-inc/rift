import { describe, expect, it, vi } from 'vitest'
import { handleBackendRouteFailure } from './route-failure'

type TestTaggedError = {
  readonly _tag: 'TestTaggedError'
  readonly requestId?: string
  readonly message: string
}

type TestClassification = {
  readonly status: number
  readonly retryable: boolean
  readonly severity: 'info' | 'warn' | 'error'
  readonly captureMode: 'none' | 'signal' | 'exception'
}

type TestWideEvent = {
  finalized: boolean
  drained: boolean
}

describe('handleBackendRouteFailure', () => {
  it('finalizes and drains a wide event before returning the response', async () => {
    const wideEvent: TestWideEvent = { finalized: false, drained: false }
    const finalizeWideEvent = vi.fn(({ wideEvent }: { wideEvent: TestWideEvent }) => {
      wideEvent.finalized = true
    })
    const drainWideEvent = vi.fn(async (event: TestWideEvent) => {
      event.drained = true
    })

    const response = await handleBackendRouteFailure<
      TestTaggedError,
      TestClassification,
      { projectId?: string },
      TestWideEvent
    >({
      error: {
        _tag: 'TestTaggedError',
        requestId: 'req-wide',
        message: 'boom',
      },
      requestId: 'fallback',
      defaultMessage: 'default',
      classifyTagged: () => ({
        status: 409,
        retryable: true,
        severity: 'warn',
        captureMode: 'signal',
      }),
      classifyUnknown: () => ({
        status: 500,
        retryable: false,
        severity: 'error',
        captureMode: 'exception',
      }),
      toReadableMessage: (error) =>
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'default',
      wideEvent,
      finalizeWideEvent,
      drainWideEvent,
      toResponse: ({ resolved }) =>
        new Response(JSON.stringify({ requestId: resolved.requestId }), {
          status: resolved.classification.status,
        }),
    })

    expect(finalizeWideEvent).toHaveBeenCalledTimes(1)
    expect(drainWideEvent).toHaveBeenCalledTimes(1)
    expect(wideEvent.finalized).toBe(true)
    expect(wideEvent.drained).toBe(true)
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ requestId: 'req-wide' })
  })

  it('runs the fallback logger path when no wide event exists', async () => {
    const onMissingWideEvent = vi.fn(async () => undefined)

    const response = await handleBackendRouteFailure<
      TestTaggedError,
      TestClassification,
      { projectId?: string },
      { readonly id: string }
    >({
      error: new Error('unexpected'),
      requestId: 'req-log',
      defaultMessage: 'default',
      classifyTagged: () => ({
        status: 409,
        retryable: true,
        severity: 'warn',
        captureMode: 'signal',
      }),
      classifyUnknown: () => ({
        status: 500,
        retryable: false,
        severity: 'error',
        captureMode: 'exception',
      }),
      toReadableMessage: (_error, fallback) => fallback ?? 'default',
      onMissingWideEvent,
      toResponse: ({ resolved }) =>
        new Response(JSON.stringify({ requestId: resolved.requestId }), {
          status: resolved.classification.status,
        }),
    })

    expect(onMissingWideEvent).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ requestId: 'req-log' })
  })
})
