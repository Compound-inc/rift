import { Effect, Layer, Logger, References } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import * as Observability from 'effect/unstable/observability'

const DEFAULT_SERVICE_NAME = 'rift'
const DEFAULT_SERVICE_VERSION = '0.0.0'
const DEFAULT_MIN_LOG_LEVEL = 'Warn'

type LogLevel =
  | 'All'
  | 'Fatal'
  | 'Error'
  | 'Warn'
  | 'Info'
  | 'Debug'
  | 'Trace'
  | 'None'

type LogFormat = 'pretty' | 'json' | 'logfmt' | 'structured'

function readStringEnv(name: string): string | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseLogLevel(input: string | undefined): LogLevel {
  switch ((input ?? '').trim()) {
    case 'All':
    case 'Fatal':
    case 'Error':
    case 'Warn':
    case 'Info':
    case 'Debug':
    case 'Trace':
    case 'None':
      return input as LogLevel
    default:
      return DEFAULT_MIN_LOG_LEVEL
  }
}

function parseLogFormat(input: string | undefined): LogFormat {
  switch ((input ?? '').trim().toLowerCase()) {
    case 'pretty':
    case 'json':
    case 'logfmt':
    case 'structured':
      return input!.trim().toLowerCase() as LogFormat
    default:
      return process.env.NODE_ENV === 'production' ? 'json' : 'pretty'
  }
}

function parseHeadersJson(
  input: string | undefined,
): Record<string, string> | undefined {
  if (!input) return undefined
  try {
    const parsed = JSON.parse(input) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }
    const entries = Object.entries(parsed)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      )
      .map(([key, value]) => [key.trim(), value.trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0)

    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  } catch {
    return undefined
  }
}

const serviceName = readStringEnv('EFFECT_SERVICE_NAME') ?? DEFAULT_SERVICE_NAME
const serviceVersion =
  readStringEnv('EFFECT_SERVICE_VERSION') ?? DEFAULT_SERVICE_VERSION
const nodeEnv = readStringEnv('NODE_ENV') ?? 'development'
const minimumLogLevel = parseLogLevel(readStringEnv('EFFECT_MIN_LOG_LEVEL'))
const selectedLogFormat = parseLogFormat(readStringEnv('EFFECT_LOG_FORMAT'))
const otlpBaseUrl = readStringEnv('EFFECT_OTLP_BASE_URL')
const otlpHeaders = parseHeadersJson(readStringEnv('EFFECT_OTLP_HEADERS_JSON'))

const loggerLayer = (() => {
  switch (selectedLogFormat) {
    case 'json':
      return Logger.layer([Logger.consoleJson], { mergeWithExisting: false })
    case 'logfmt':
      return Logger.layer([Logger.consoleLogFmt], { mergeWithExisting: false })
    case 'structured':
      return Logger.layer([Logger.consoleStructured], {
        mergeWithExisting: false,
      })
    case 'pretty':
    default:
      return Logger.layer([Logger.consolePretty({ colors: 'auto' })], {
        mergeWithExisting: false,
      })
  }
})()

const minimumLogLevelLayer = Layer.succeed(
  References.MinimumLogLevel,
  minimumLogLevel,
)

const unhandledLogLevelLayer = Layer.succeed(
  References.UnhandledLogLevel,
  'Error',
)

const otlpLayer = otlpBaseUrl
  ? Observability.Otlp.layerJson({
      baseUrl: otlpBaseUrl,
      headers: otlpHeaders,
      resource: {
        serviceName,
        serviceVersion,
        attributes: {
          'deployment.environment': nodeEnv,
        },
      },
      loggerMergeWithExisting: true,
    }).pipe(Layer.provideMerge(FetchHttpClient.layer))
  : Layer.empty

/**
 * Shared observability layer for all server runtimes.
 * It standardizes:
 * - logger format and minimum level,
 * - unhandled error severity,
 * - optional OTLP export (logs/traces/metrics) when configured.
 */
export const ServerObservabilityLayer = Layer.mergeAll(
  loggerLayer,
  minimumLogLevelLayer,
  unhandledLogLevelLayer,
  otlpLayer,
)

/**
 * Applies baseline runtime annotations/span so every server program execution
 * carries consistent metadata across logs and traces.
 */
export const withServerRuntimeObservability = <TValue, TError, TRequirements>(
  effect: Effect.Effect<TValue, TError, TRequirements>,
): Effect.Effect<TValue, TError, TRequirements> =>
  effect.pipe(
    Effect.annotateLogs({
      service: serviceName,
      service_version: serviceVersion,
      environment: nodeEnv,
    }),
    Effect.withSpan('server.runtime.execute'),
  )
