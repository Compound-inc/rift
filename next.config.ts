import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const isCI = Boolean(process.env.CI);
const isVercel = Boolean(process.env.VERCEL);

// Work around sentry-cli occasionally failing to write to stdout on Vercel (EAGAIN / os error 11).
// These env vars are read by sentry-cli and are safe to set at build time.
if (isCI || isVercel) {
  process.env.SENTRYCLI_LOG_STREAM ??= "stderr";
  process.env.SENTRYCLI_LOG_LEVEL ??= "error";
  process.env.SENTRYCLI_NO_PROGRESS_BAR ??= "1";
}

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/relay-7ls5/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/relay-7ls5/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default withSentryConfig(withBotId(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "compound-xu",

  project: "rift",

  // Vercel build logs can trigger a sentry-cli stdout EAGAIN (os error 11).
  // Keep uploads enabled, but avoid noisy CLI/progress output in CI/Vercel.
  silent: isCI || isVercel,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
