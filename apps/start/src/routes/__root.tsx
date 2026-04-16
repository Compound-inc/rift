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
import {
  buildAbsoluteMetadataUrl,
  buildRootLinks,
  buildRootMetadata,
  DEFAULT_SITE_METADATA,
  getAppOrigin,
} from '@/lib/frontend/metadata/metadata.functions'

/**
 * Applies the stored or system theme before the stylesheet paints.
 */
const THEME_INIT_SCRIPT = `
(() => {
  const storageKey = 'theme';
  const root = document.documentElement;

  try {
    const stored = localStorage.getItem(storageKey);
    const theme = stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
    setFavicon(resolved === 'dark');
  } catch {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = systemDark ? 'dark' : 'light';

    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
    setFavicon(resolved === 'dark');
  }
})();

function setFavicon(isDark) {
  const suffix = isDark ? '' : '-light';
  const icons = [
    { selector: 'link[rel="icon"][type="image/x-icon"]', href: '/favicon' + suffix + '.ico' },
    { selector: 'link[rel="icon"][sizes="32x32"]', href: '/favicon' + suffix + '-32x32.png' },
    { selector: 'link[rel="icon"][sizes="16x16"]', href: '/favicon' + suffix + '-16x16.png' },
    { selector: 'link[rel="apple-touch-icon"]', href: '/apple-touch-icon' + suffix + '.png' },
  ];
  icons.forEach(({ selector, href }) => {
    const link = document.querySelector(selector);
    if (link) {
      link.setAttribute('href', href);
    }
  });
}
`

export const Route = createRootRoute({
  loader: async () => ({
    posthog: await getPublicPostHogConfigFn(),
    origin: await getAppOrigin(),
  }),
  head: ({ loaderData, matches, match }) => {
    const origin = loaderData!.origin
    const currentPathname = match.pathname || matches.at(-1)?.pathname || '/'
    const canonicalUrl = buildAbsoluteMetadataUrl(currentPathname, origin)
    const socialImageUrl = buildAbsoluteMetadataUrl(
      DEFAULT_SITE_METADATA.socialImagePath,
      origin
    )

    return {
      meta: buildRootMetadata({
        canonicalUrl,
        socialImageUrl,
      }),
      links: buildRootLinks({
        appCssHref: appCss,
        canonicalUrl,
      }),
    }
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { posthog } = Route.useLoaderData()
  const locale = getLocale()
  const direction = getLocaleDirection(locale)

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
