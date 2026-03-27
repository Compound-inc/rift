import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import ZeroProvider from '../integrations/zero/provider'
import { ThemeProvider } from '@rift/ui/hooks/useTheme'
import { Toaster } from '@rift/ui/sonner'
import { TooltipProvider } from '@rift/ui/tooltip'
import { DirectionProvider, getLocaleDirection } from '@rift/ui/direction'

import appCss from '../styles.css?url'
import { getLocale } from '@/paraglide/runtime.js'
import { PostHogClientBootstrap } from '@/components/app/posthog-client-bootstrap'
import { getPublicPostHogConfigFn } from '@/lib/frontend/observability/posthog.functions'

export const Route = createRootRoute({
  loader: async () => ({
    posthog: await getPublicPostHogConfigFn(),
  }),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Rift',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { posthog } = Route.useLoaderData()
  const locale = getLocale()
  const direction = getLocaleDirection(locale)

  return (
    <html lang={locale} dir={direction}>
      <head>
        <HeadContent />
      </head>
      <body>
        <DirectionProvider direction={direction}>
          <ZeroProvider>
            <ThemeProvider>
              <TooltipProvider delay={100}>
                <PostHogClientBootstrap config={posthog} />
                {children}
                <Toaster />
                <TanStackDevtools
                  config={{
                    position: 'bottom-right',
                  }}
                  plugins={[
                    {
                      name: 'Tanstack Router',
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                  ]}
                />
              </TooltipProvider>
            </ThemeProvider>
          </ZeroProvider>
        </DirectionProvider>
        <Scripts />
      </body>
    </html>
  )
}
