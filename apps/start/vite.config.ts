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
    server: {
      allowedHosts: ['omarchy-1.echo-tailor.ts.net'],
    },
    optimizeDeps: {
      exclude: ['streamdown', '@streamdown/code', '@streamdown/math', '@streamdown/mermaid'],
    },
    ssr: {
      noExternal: ['streamdown', '@streamdown/code', '@streamdown/math', '@streamdown/mermaid'],
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
