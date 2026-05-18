import { Effect, Layer, ServiceMap } from 'effect'
import { FileConversionError } from '../domain/errors'
import { getServerInstanceCapabilities } from '@/lib/backend/self-host/instance-settings.service'

const DEFAULT_WORKER_TIMEOUT_MS = 20_000

type MarkdownWorkerResponse = {
  readonly markdown?: unknown
  readonly error?: unknown
  readonly tokens?: unknown
}

type WorkerRequestHandle = {
  readonly controller: AbortController
  readonly timeoutId: ReturnType<typeof setTimeout>
}

export type MarkdownConversionServiceShape = {
  readonly convertFromUrl: (input: {
    readonly fileUrl: string
    readonly fileName: string
    readonly requestId: string
    readonly sourceFile?: File
  }) => Effect.Effect<
    {
      readonly markdown: string
      readonly tokenCount: number
    },
    FileConversionError
  >
}

/**
 * Shared markdown conversion adapter
 */
export class MarkdownConversionService extends ServiceMap.Service<
  MarkdownConversionService,
  MarkdownConversionServiceShape
>()('file-backend/MarkdownConversionService') {
  static readonly layer = Layer.succeed(this, {
    convertFromUrl: Effect.fn('MarkdownConversionService.convertFromUrl')(
      ({ fileUrl, fileName, requestId, sourceFile }) =>
        Effect.gen(function* () {
          const capabilities = getServerInstanceCapabilities()
          const workerUrl = readRequiredEnv('CF_MARKDOWN_WORKER_URL')
          const workerToken = readRequiredEnv('CF_MARKDOWN_WORKER_TOKEN')
          if (!capabilities.markdownWorkerAvailable || !workerUrl || !workerToken) {
            return yield* Effect.fail(
              new FileConversionError({
                message:
                  'Markdown conversion is disabled because CF_MARKDOWN_WORKER_URL or CF_MARKDOWN_WORKER_TOKEN is missing.',
                requestId,
                statusCode: 503,
              }),
            )
          }

          const timeoutMs = Number.parseInt(
            process.env.CF_MARKDOWN_WORKER_TIMEOUT_MS ?? '',
            10,
          )
          const effectiveTimeoutMs = Number.isFinite(timeoutMs)
            ? Math.max(1_000, timeoutMs)
            : DEFAULT_WORKER_TIMEOUT_MS
          const { response, workerPayload } = yield* Effect.acquireRelease(
            Effect.sync(() => {
              const controller = new AbortController()
              const timeoutId = setTimeout(
                () => controller.abort(),
                effectiveTimeoutMs,
              )

              return {
                controller,
                timeoutId,
              } satisfies WorkerRequestHandle
            }),
            ({ controller, timeoutId }) =>
              Effect.sync(() => {
                clearTimeout(timeoutId)
                if (!controller.signal.aborted) {
                  controller.abort()
                }
              }),
          ).pipe(
            Effect.flatMap(({ controller }) =>
              Effect.gen(function* () {
                const workerRequestBody = yield* buildWorkerRequestBody({
                  fileUrl,
                  fileName,
                  sourceFile,
                  requestId,
                })

                const response = yield* Effect.tryPromise({
                  try: () =>
                    fetch(resolveWorkerConvertUrl(workerUrl), {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${workerToken}`,
                      },
                      body: JSON.stringify(workerRequestBody),
                      signal: controller.signal,
                    }),
                  catch: (error) => {
                    if (error instanceof Error && error.name === 'AbortError') {
                      return new FileConversionError({
                        message: 'Markdown conversion timed out',
                        requestId,
                        statusCode: 504,
                      })
                    }
                    return new FileConversionError({
                      message: 'Failed to convert uploaded file',
                      requestId,
                      statusCode: 502,
                      cause: String(error),
                    })
                  },
                })

                const workerPayload = (yield* Effect.tryPromise({
                  try: async () => {
                    try {
                      return (await response.json()) as MarkdownWorkerResponse
                    } catch {
                      return null
                    }
                  },
                  catch: (error) =>
                    new FileConversionError({
                      message: 'Failed to read markdown conversion response',
                      requestId,
                      statusCode: 502,
                      cause: String(error),
                    }),
                }))

                return { response, workerPayload }
              }),
            ),
            Effect.scoped,
          )

          if (!response.ok) {
            const message =
              workerPayload && typeof workerPayload.error === 'string'
                ? workerPayload.error
                : 'Failed to convert uploaded file'
            return yield* Effect.fail(
              new FileConversionError({
                message,
                requestId,
                statusCode: response.status,
              }),
            )
          }

          const markdown =
            workerPayload && typeof workerPayload.markdown === 'string'
              ? workerPayload.markdown
              : ''
          if (!markdown) {
            return yield* Effect.fail(
              new FileConversionError({
                message: 'Conversion response did not include markdown',
                requestId,
                statusCode: 502,
              }),
            )
          }

          const tokenCount =
            workerPayload && typeof workerPayload.tokens === 'number'
              ? workerPayload.tokens
              : 0

          return {
            markdown,
            tokenCount,
          }
        }),
    ),
  })
}

function readRequiredEnv(name: string): string | null {
  const raw = process.env[name]
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildWorkerRequestBody(input: {
  readonly fileUrl: string
  readonly fileName: string
  readonly sourceFile?: File
  readonly requestId: string
}) {
  return Effect.tryPromise({
    try: async () => {
      const sourceBase64 = input.sourceFile
        ? Buffer.from(await input.sourceFile.arrayBuffer()).toString('base64')
        : undefined

      return {
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        sourceBase64,
        mimeType: input.sourceFile?.type,
      }
    },
    catch: (error) =>
      new FileConversionError({
        message: 'Failed to prepare markdown conversion request',
        requestId: input.requestId,
        statusCode: 500,
        cause: String(error),
      }),
  })
}

function resolveWorkerConvertUrl(workerUrl: string): string {
  const normalized = workerUrl.trim()
  if (normalized.endsWith('/convert')) return normalized
  return `${normalized.replace(/\/$/, '')}/convert`
}
