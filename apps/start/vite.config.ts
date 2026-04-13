import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ command }) => {
  const isDevServer = command === 'serve'

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
      tanstackStart(),
      nitro({
        preset: 'bun',
        compressPublicAssets: {
          gzip: true,
          brotli: true,
        },
      }),
      viteReact({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
    ],
  }
})

export default config
