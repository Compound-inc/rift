import { NodeSdk } from "@effect/opentelemetry";
import { SentrySpanProcessor } from "@sentry/opentelemetry";
import { Layer } from "effect";

/**
 * Effect tracing layer configured with Sentry's OpenTelemetry span processor.
 * This enables distributed tracing that sends spans to Sentry for analysis.
 *
 * Usage:
 * ```ts
 * const program = myEffect.pipe(Effect.provide(EffectTracingLayer))
 * ```
 */
export const EffectTracingLayer = NodeSdk.layer(() => ({
  resource: {
    serviceName: "rift-api",
    serviceVersion: process.env.npm_package_version || "1.0.0",
  },
  spanProcessor: new SentrySpanProcessor(),
}));

