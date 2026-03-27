import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import posthogRollupPlugin from '@posthog/rollup-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { DEFAULT_POSTHOG_HOST } from './src/lib/shared/observability/posthog-config'

function readTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

const config = defineConfig(({ command }) => {
  const isDevServer = command === 'serve'
  const posthogProjectId = readTrimmedEnv('POSTHOG_PROJECT_ID')
  const posthogPersonalApiKey = readTrimmedEnv('POSTHOG_PERSONAL_API_KEY')
  const posthogRelease =
    readTrimmedEnv('RAILWAY_GIT_COMMIT_SHA')
    ?? readTrimmedEnv('GITHUB_SHA')
  const posthogHost = readTrimmedEnv('POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST

  return {
    /**
     * Expose non-secret feature-flag env vars to the client so browser code
     * and server code resolve the same runtime flag values.
     */
    envPrefix: ['VITE_', 'ENABLE_'],
    resolve: {
      dedupe: [
        '@rocicorp/zero',
        '@rocicorp/zero/react',
        '@rocicorp/zero-virtual',
      ],
    },
    server: {
      allowedHosts: ['omarchy-1.echo-tailor.ts.net'],
    },
    optimizeDeps: {
      exclude: [
        'streamdown',
        '@streamdown/code',
        '@streamdown/math',
        '@streamdown/mermaid',
        '@rocicorp/zero',
        '@rocicorp/zero/react',
        '@rocicorp/zero-virtual',
      ],
    },
    ssr: {
      noExternal: [
        'streamdown',
        '@streamdown/code',
        '@streamdown/math',
        '@streamdown/mermaid',
        '@rocicorp/zero-virtual',
      ],
    },
    plugins: [
      ...(isDevServer
        ? [
            paraglideVitePlugin({
              project: './project.inlang',
              outdir: './src/paraglide',
              outputStructure: 'message-modules',
              cookieName: 'PARAGLIDE_LOCALE',
              strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
            }),
          ]
        : []),
      devtools(),
      tsconfigPaths({ projects: ['./tsconfig.json'] }),
      tailwindcss(),
      ...(
        !isDevServer &&
        posthogProjectId &&
        posthogPersonalApiKey &&
        posthogRelease
          ? [
              posthogRollupPlugin({
                host: posthogHost,
                personalApiKey: posthogPersonalApiKey,
                projectId: posthogProjectId,
                sourcemaps: {
                  enabled: true,
                  releaseName: 'rift-start',
                  releaseVersion: posthogRelease,
                },
              }),
            ]
          : []
      ),
      tanstackStart(),
      nitro({ preset: 'bun' }),
      viteReact({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
    ],
  }
})

export default config
