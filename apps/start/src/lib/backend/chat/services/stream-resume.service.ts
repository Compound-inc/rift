import { Effect, Layer, ServiceMap } from 'effect'
import { createResumableStreamContext } from 'resumable-stream'
import { createClient } from 'redis'
import { StreamProtocolError } from '../domain/errors'

/** Redis payload stored for "active stream per user/thread" tracking. */
type ActiveStreamRecord = {
  readonly streamId: string
  readonly requestId: string
  readonly startedAt: number
}

/** In-process handle used to abort and unsubscribe local streams. */
type LocalStreamHandle = {
  readonly abortController: AbortController
  readonly unsubscribe: () => Promise<void>
}

/** Shared runtime to avoid opening duplicate Redis connections per request. */
type ResumeRuntime = {
  readonly publisher: ReturnType<typeof createClient>
  readonly subscriber: ReturnType<typeof createClient>
  readonly streamContext: ReturnType<typeof createResumableStreamContext>
  readonly localHandles: Map<string, LocalStreamHandle>
  readonly localStreams: Map<string, LocalLiveStream>
}

type LocalLiveStream = {
  readonly chunks: string[]
  readonly listeners: Set<ReadableStreamDefaultController<string>>
  bufferedChars: number
  canReplayFromStart: boolean
  done: boolean
  released: boolean
}

const ACTIVE_STREAM_TTL_SECONDS = 5 * 60
const STOP_CHANNEL_PREFIX = 'chat:stop:v1'
const ACTIVE_KEY_PREFIX = 'chat:active:v1'
const RESUMABLE_KEY_PREFIX = 'chat:resume:v1'
const RESUME_BATCH_MAX_CHARS = 16384
const RESUME_BATCH_MAX_DELAY_MS = 100
const LOCAL_RESUME_MAX_BUFFER_CHARS = 256_000

/** Pub/sub channel used to broadcast stop requests across instances. */
function getStopChannel(streamId: string): string {
  return `${STOP_CHANNEL_PREFIX}:${streamId}`
}

/** Per-thread active stream key. */
function getActiveKey(userId: string, threadId: string): string {
  return `${ACTIVE_KEY_PREFIX}:${userId}:${threadId}`
}

/** Parses Redis JSON into a validated active-stream record. */
function parseActiveStreamRecord(
  value: string | null,
): ActiveStreamRecord | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<ActiveStreamRecord>
    if (
      typeof parsed.streamId === 'string' &&
      typeof parsed.requestId === 'string' &&
      typeof parsed.startedAt === 'number'
    ) {
      return {
        streamId: parsed.streamId,
        requestId: parsed.requestId,
        startedAt: parsed.startedAt,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Batches raw SSE chunks to reduce Redis write amplification while preserving
 * resume fidelity for reconnecting clients.
 */
function batchSseStream(
  stream: ReadableStream<string>,
  options: {
    readonly maxChars: number
    readonly maxDelayMs: number
  },
): ReadableStream<string> {
  const { maxChars, maxDelayMs } = options

  let reader: ReadableStreamDefaultReader<string> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const clearTimer = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
  }

  return new ReadableStream<string>({
    start(controller) {
      reader = stream.getReader()
      const currentReader = reader
      let buffer = ''

      const flush = () => {
        if (!buffer) return
        controller.enqueue(buffer)
        buffer = ''
      }

      const scheduleFlush = () => {
        if (timer) return
        timer = setTimeout(() => {
          timer = undefined
          flush()
        }, maxDelayMs)
      }

      const pump = async () => {
        try {
          for (;;) {
            const { done, value } = await currentReader.read()
            if (done) break
            buffer += value
            if (buffer.length >= maxChars) {
              clearTimer()
              flush()
              continue
            }
            scheduleFlush()
          }
          clearTimer()
          flush()
          controller.close()
        } catch (error) {
          clearTimer()
          controller.error(error)
        } finally {
          currentReader.releaseLock()
        }
      }

      void pump()
    },
    cancel() {
      clearTimer()
      return reader?.cancel().catch(() => undefined)
    },
  })
}

/**
 * Releases all in-memory state for a local replay stream. This is called from
 * both explicit cleanup paths and abort listeners so buffered SSE chunks do not
 * survive after the stream lifecycle is over.
 */
function closeLocalLiveStream(local: LocalLiveStream) {
  if (local.released) return

  local.released = true
  local.done = true
  local.bufferedChars = 0
  local.canReplayFromStart = false
  local.chunks.length = 0

  for (const listener of Array.from(local.listeners)) {
    try {
      listener.close()
    } catch {
      // ignore
    }
  }
  local.listeners.clear()
}

/**
 * Local replay is an optimization for same-instance reconnects. Once the buffer
 * exceeds the cap we fall back to Redis-backed resume so process memory stays
 * bounded without serving partial local history.
 */
function pushLocalReplayChunk(local: LocalLiveStream, chunk: string) {
  local.chunks.push(chunk)
  local.bufferedChars += chunk.length

  while (
    local.bufferedChars > LOCAL_RESUME_MAX_BUFFER_CHARS &&
    local.chunks.length > 0
  ) {
    const removed = local.chunks.shift()
    if (!removed) break
    local.bufferedChars -= removed.length
    local.canReplayFromStart = false
  }
}

/** Creates an in-memory replay stream for same-instance reconnects. */
function createLocalResumeStream(
  local: LocalLiveStream,
): ReadableStream<string> {
  let registered: ReadableStreamDefaultController<string> | null = null

  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of local.chunks) {
        controller.enqueue(chunk)
      }

      if (local.done) {
        controller.close()
        return
      }

      local.listeners.add(controller)
      registered = controller
    },
    cancel() {
      if (registered) {
        local.listeners.delete(registered)
        registered = null
      }
    },
  })
}

function toProtocolError(input: {
  readonly requestId: string
  readonly message: string
  readonly error: unknown
}) {
  return new StreamProtocolError({
    message: input.message,
    requestId: input.requestId,
    cause: String(input.error),
  })
}

type StreamResumeRuntimeServiceShape = ResumeRuntime

/**
 * Internal scoped runtime dependency for Redis + resumable-stream resources.
 * Layer memoization guarantees a single connected runtime per app process.
 */
class StreamResumeRuntimeService extends ServiceMap.Service<
  StreamResumeRuntimeService,
  StreamResumeRuntimeServiceShape
>()('chat-backend/StreamResumeRuntimeService') {
  static readonly layer = Layer.effect(
    this,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const redisUrl = process.env.REDIS_URL
          if (!redisUrl) {
            throw new Error('REDIS_URL is not configured')
          }

          const publisher = createClient({ url: redisUrl })
          const subscriber = createClient({ url: redisUrl })

          if (!publisher.isOpen) {
            await publisher.connect()
          }
          if (!subscriber.isOpen) {
            await subscriber.connect()
          }

          return {
            publisher,
            subscriber,
            streamContext: createResumableStreamContext({
              keyPrefix: RESUMABLE_KEY_PREFIX,
              waitUntil: null,
              publisher,
              subscriber,
            }),
            localHandles: new Map<string, LocalStreamHandle>(),
            localStreams: new Map<string, LocalLiveStream>(),
          }
        },
        catch: (error) => error,
      }),
      (runtime) =>
        Effect.tryPromise({
          /**
           * Shutdown should never fail the layer release path. We still await
           * Redis client quits so the process does not leak sockets, but any
           * close error is reduced to the release boundary and then dropped.
           */
          try: async () => {
            runtime.localHandles.clear()
            for (const local of runtime.localStreams.values()) {
              closeLocalLiveStream(local)
            }
            runtime.localStreams.clear()
            const closers: Promise<unknown>[] = []
            if (runtime.subscriber.isOpen) {
              closers.push(runtime.subscriber.quit())
            }
            if (runtime.publisher.isOpen) {
              closers.push(runtime.publisher.quit())
            }
            await Promise.allSettled(closers)
          },
          catch: (error) => error,
        }).pipe(Effect.orDie),
    ),
  )
}

/** Service contract for stream resume/stop lifecycle management. */
export type StreamResumeServiceShape = {
  readonly getActiveStreamId: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
  }) => Effect.Effect<string | null, StreamProtocolError>
  readonly registerActiveStream: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
    readonly streamId: string
    readonly abortController: AbortController
  }) => Effect.Effect<void, StreamProtocolError>
  readonly persistSseStream: (input: {
    readonly streamId: string
    readonly requestId: string
    readonly stream: ReadableStream<string>
    readonly onPhaseChange?: (phase: string) => void
  }) => Effect.Effect<void, StreamProtocolError>
  readonly resumeStream: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
  }) => Effect.Effect<ReadableStream<string> | null, StreamProtocolError>
  readonly stopStream: (input: {
    readonly streamId: string
    readonly requestId: string
  }) => Effect.Effect<void, StreamProtocolError>
  readonly clearActiveStream: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
    readonly expectedStreamId?: string
  }) => Effect.Effect<void, StreamProtocolError>
  readonly releaseLocalStream: (input: {
    readonly streamId: string
    readonly requestId: string
  }) => Effect.Effect<void, StreamProtocolError>
}

/** Injectable stream resume service token. */
export class StreamResumeService extends ServiceMap.Service<
  StreamResumeService,
  StreamResumeServiceShape
>()('chat-backend/StreamResumeService') {
  /** Redis-backed stream resume implementation. */
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const runtime = yield* StreamResumeRuntimeService

      const getActiveStreamId = Effect.fn(
        'StreamResumeService.getActiveStreamId',
      )(
        ({
          userId,
          threadId,
          requestId,
        }: {
          readonly userId: string
          readonly threadId: string
          readonly requestId: string
        }) =>
          Effect.tryPromise({
            try: async () => {
              const record = parseActiveStreamRecord(
                await runtime.publisher.get(getActiveKey(userId, threadId)),
              )
              return record?.streamId ?? null
            },
            catch: (error) =>
              toProtocolError({
                requestId,
                message: 'Failed to read active stream',
                error,
              }),
          }),
      )

      const registerActiveStream = Effect.fn(
        'StreamResumeService.registerActiveStream',
      )(
        ({
          userId,
          threadId,
          requestId,
          streamId,
          abortController,
        }: {
          readonly userId: string
          readonly threadId: string
          readonly requestId: string
          readonly streamId: string
          readonly abortController: AbortController
        }) =>
          Effect.tryPromise({
            try: async () => {
              const channel = getStopChannel(streamId)

              const unsubscribe = async () => {
                await runtime.subscriber.unsubscribe(channel)
              }

              await runtime.subscriber.subscribe(channel, () => {
                abortController.abort()
              })

              runtime.localHandles.set(streamId, {
                abortController,
                unsubscribe,
              })
              runtime.localStreams.set(streamId, {
                chunks: [],
                listeners: new Set(),
                bufferedChars: 0,
                canReplayFromStart: true,
                done: false,
                released: false,
              })

              abortController.signal.addEventListener(
                'abort',
                () => {
                  void unsubscribe().catch(() => undefined)
                  runtime.localHandles.delete(streamId)
                  const local = runtime.localStreams.get(streamId)
                  if (local) {
                    closeLocalLiveStream(local)
                    runtime.localStreams.delete(streamId)
                  }
                },
                { once: true },
              )

              await runtime.publisher.set(
                getActiveKey(userId, threadId),
                JSON.stringify({
                  streamId,
                  requestId,
                  startedAt: Date.now(),
                } satisfies ActiveStreamRecord),
                { EX: ACTIVE_STREAM_TTL_SECONDS },
              )
            },
            catch: (error) =>
              toProtocolError({
                requestId,
                message: 'Failed to register active stream',
                error,
              }),
          }),
      )

      const persistSseStream = Effect.fn(
        'StreamResumeService.persistSseStream',
      )(({
        streamId,
        requestId,
        stream,
        onPhaseChange,
      }: {
        readonly streamId: string
        readonly requestId: string
        readonly stream: ReadableStream<string>
        readonly onPhaseChange?: (phase: string) => void
      }) => {
        let currentPhase = 'initializing'
        return Effect.tryPromise({
          try: async () => {
            const setPhase = (phase: string) => {
              currentPhase = phase
              onPhaseChange?.(phase)
            }

            setPhase('batch_sse_stream')
            const batchedStream = batchSseStream(stream, {
              maxChars: RESUME_BATCH_MAX_CHARS,
              maxDelayMs: RESUME_BATCH_MAX_DELAY_MS,
            })
            const [redisStream, localStream] = batchedStream.tee()

            const local = runtime.localStreams.get(streamId)
            if (local) {
              setPhase('mirror_local_stream')
              void (async () => {
                const localReader = localStream.getReader()
                try {
                  for (;;) {
                    const { done, value } = await localReader.read()
                    if (done) break
                    if (local.released) {
                      await localReader.cancel()
                      break
                    }
                    pushLocalReplayChunk(local, value)
                    for (const listener of Array.from(local.listeners)) {
                      try {
                        listener.enqueue(value)
                      } catch {
                        local.listeners.delete(listener)
                      }
                    }
                  }
                } catch {
                  if (!local.released) {
                    for (const listener of Array.from(local.listeners)) {
                      try {
                        listener.error(
                          new Error('Local replay stream failed unexpectedly'),
                        )
                      } catch {
                        // ignore
                      }
                    }
                  }
                } finally {
                  local.done = true
                  if (local.released) {
                    local.bufferedChars = 0
                    local.chunks.length = 0
                  } else {
                    for (const listener of Array.from(local.listeners)) {
                      try {
                        listener.close()
                      } catch {
                        // ignore
                      }
                    }
                    local.listeners.clear()
                  }
                  localReader.releaseLock()
                }
              })().catch(() => undefined)
            }

            setPhase('create_resumable_stream')
            const resumableStream =
              await runtime.streamContext.createNewResumableStream(
                streamId,
                () => redisStream,
              )

            if (!resumableStream) return

            // Drain the internal stream so the resumable context never stalls on backpressure.
            setPhase('drain_resumable_stream')
            const reader = resumableStream.getReader()
            try {
              for (;;) {
                const { done } = await reader.read()
                if (done) break
              }
            } finally {
              reader.releaseLock()
            }

            setPhase('completed')
          },
          catch: (error) =>
            toProtocolError({
              requestId,
              message:
                'Failed to persist resumable stream during detached persistence',
              error: `phase=${currentPhase}; ${String(error)}`,
            }),
        })
      })

      const resumeStream = Effect.fn('StreamResumeService.resumeStream')(
        ({
          userId,
          threadId,
          requestId,
        }: {
          readonly userId: string
          readonly threadId: string
          readonly requestId: string
        }) =>
          Effect.tryPromise({
            try: async () => {
              const key = getActiveKey(userId, threadId)
              const record = parseActiveStreamRecord(
                await runtime.publisher.get(key),
              )
              if (!record) return null

              const local = runtime.localStreams.get(record.streamId)
              if (
                local &&
                !local.done &&
                !local.released &&
                local.canReplayFromStart
              ) {
                // Prefer in-process replay to reduce Redis read pressure for fast reconnects.
                return createLocalResumeStream(local)
              }

              const stream = await runtime.streamContext.resumeExistingStream(
                record.streamId,
              )
              if (!stream) {
                await runtime.publisher.set(key, '', { EX: 1 })
                return null
              }

              return stream
            },
            catch: (error) =>
              toProtocolError({
                requestId,
                message: 'Failed to resume active stream',
                error,
              }),
          }),
      )

      const stopStream = Effect.fn('StreamResumeService.stopStream')(
        ({
          streamId,
          requestId,
        }: {
          readonly streamId: string
          readonly requestId: string
        }) =>
          Effect.tryPromise({
            try: async () => {
              const local = runtime.localHandles.get(streamId)
              local?.abortController.abort()
              await runtime.publisher.publish(getStopChannel(streamId), 'stop')
            },
            catch: (error) =>
              toProtocolError({
                requestId,
                message: 'Failed to stop active stream',
                error,
              }),
          }),
      )

      const clearActiveStream = Effect.fn(
        'StreamResumeService.clearActiveStream',
      )(
        ({
          userId,
          threadId,
          requestId,
          expectedStreamId,
        }: {
          readonly userId: string
          readonly threadId: string
          readonly requestId: string
          readonly expectedStreamId?: string
        }) =>
          Effect.tryPromise({
            try: async () => {
              const key = getActiveKey(userId, threadId)
              const current = parseActiveStreamRecord(
                await runtime.publisher.get(key),
              )
              if (!current) return
              if (expectedStreamId && current.streamId !== expectedStreamId)
                return
              await runtime.publisher.set(key, '', { EX: 1 })
            },
            catch: (error) =>
              toProtocolError({
                requestId,
                message: 'Failed to clear active stream',
                error,
              }),
          }),
      )

      const releaseLocalStream = Effect.fn(
        'StreamResumeService.releaseLocalStream',
      )(
        ({
          streamId,
          requestId,
        }: {
          readonly streamId: string
          readonly requestId: string
        }) =>
          Effect.tryPromise({
            try: async () => {
              const handle = runtime.localHandles.get(streamId)
              runtime.localHandles.delete(streamId)
              if (handle) {
                await handle.unsubscribe()
              }
              const local = runtime.localStreams.get(streamId)
              if (local) {
                closeLocalLiveStream(local)
                runtime.localStreams.delete(streamId)
              }
            },
            catch: (error) =>
              toProtocolError({
                requestId,
                message: 'Failed to release local stream',
                error,
              }),
          }),
      )

      return {
        getActiveStreamId,
        registerActiveStream,
        persistSseStream,
        resumeStream,
        stopStream,
        clearActiveStream,
        releaseLocalStream,
      }
    }),
  ).pipe(Layer.provide(StreamResumeRuntimeService.layer))

  /** Test adapter for non-networked unit tests. */
  static readonly layerMemory = Layer.succeed(this, {
    getActiveStreamId: Effect.fn('StreamResumeService.getActiveStreamIdMemory')(
      ({
        userId,
        threadId,
      }: {
        readonly userId: string
        readonly threadId: string
      }) =>
        Effect.succeed(
          memoryActiveStreams.get(memoryKey(userId, threadId)) ?? null,
        ),
    ),
    registerActiveStream: Effect.fn(
      'StreamResumeService.registerActiveStreamMemory',
    )(
      ({
        userId,
        threadId,
        streamId,
      }: {
        readonly userId: string
        readonly threadId: string
        readonly streamId: string
      }) =>
        Effect.sync(() => {
          memoryActiveStreams.set(memoryKey(userId, threadId), streamId)
        }),
    ),
    persistSseStream: Effect.fn('StreamResumeService.persistSseStreamMemory')(
      () => Effect.void,
    ),
    resumeStream: Effect.fn('StreamResumeService.resumeStreamMemory')(() =>
      Effect.succeed(null),
    ),
    stopStream: Effect.fn('StreamResumeService.stopStreamMemory')(
      () => Effect.void,
    ),
    clearActiveStream: Effect.fn('StreamResumeService.clearActiveStreamMemory')(
      ({
        userId,
        threadId,
        expectedStreamId,
      }: {
        readonly userId: string
        readonly threadId: string
        readonly expectedStreamId?: string
      }) =>
        Effect.sync(() => {
          const key = memoryKey(userId, threadId)
          const current = memoryActiveStreams.get(key)
          if (!current) return
          if (expectedStreamId && current !== expectedStreamId) return
          memoryActiveStreams.delete(key)
        }),
    ),
    releaseLocalStream: Effect.fn(
      'StreamResumeService.releaseLocalStreamMemory',
    )(() => Effect.void),
  })

  /**
   * Redis-disabled/self-hosted adapter.
   */
  static readonly layerDisabled = Layer.succeed(this, {
    getActiveStreamId: Effect.fn(
      'StreamResumeService.getActiveStreamIdDisabled',
    )(() => Effect.succeed(null)),
    registerActiveStream: Effect.fn(
      'StreamResumeService.registerActiveStreamDisabled',
    )(() => Effect.void),
    persistSseStream: Effect.fn('StreamResumeService.persistSseStreamDisabled')(
      () => Effect.void,
    ),
    resumeStream: Effect.fn('StreamResumeService.resumeStreamDisabled')(() =>
      Effect.succeed(null),
    ),
    stopStream: Effect.fn('StreamResumeService.stopStreamDisabled')(
      () => Effect.void,
    ),
    clearActiveStream: Effect.fn(
      'StreamResumeService.clearActiveStreamDisabled',
    )(() => Effect.void),
    releaseLocalStream: Effect.fn(
      'StreamResumeService.releaseLocalStreamDisabled',
    )(() => Effect.void),
  })
}

const memoryActiveStreams = new Map<string, string>()

function memoryKey(userId: string, threadId: string): string {
  return `${userId}:${threadId}`
}
